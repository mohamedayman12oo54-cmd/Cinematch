<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\TmdbMediaType;
use App\Models\TitleTmdbMapping;
use Illuminate\Support\Facades\Cache;

/**
 * Orchestrates matching ML titles to TMDB records, and caching the result —
 * TmdbService only knows how to talk to TMDB; this class decides *when* to
 * bother.
 *
 * Hybrid strategy (docs/archeticutre_enhancement/06_Q4_CachingStrategy.svg):
 *   1. Cache          — fastest, ~1ms, cleared on deploy/restart
 *   2. DB mapping table — survives cache clears, and (crucially) skips the
 *                         fragile title→TMDB search/match step entirely
 *   3. TMDB API        — last resort; result is saved to both layers so
 *                         every future request for the same title is a
 *                         cache hit
 *
 * A "miss" (no TMDB match, or TMDB unreachable) is cached too, but only
 * briefly — a transient TMDB outage shouldn't lock a title out of
 * enrichment for a full day, while a title that's genuinely absent from
 * TMDB just keeps re-missing cheaply (no DB row is ever written for it).
 */
class TmdbMappingService
{
    private const int NEGATIVE_CACHE_TTL_HOURS = 1;

    public function __construct(private readonly TmdbService $tmdbService) {}

    // ======= Full Enrichment (Title Details) =======

    /**
     * @return array{poster_url: ?string, backdrop_url: ?string, overview: ?string, vote_average: ?float, runtime: ?int, cast: array<int, string>, trailer_key: ?string, tmdb_available: bool}
     */
    public function resolve(string $title, ?int $releaseYear, TmdbMediaType $type): array
    {
        $cacheKey = $this->detailsCacheKey($title, $releaseYear);

        if (Cache::has($cacheKey)) {
            return Cache::get($cacheKey);
        }

        $mapping = $this->findOrCreateMapping($title, $releaseYear, $type);

        if (! $mapping instanceof TitleTmdbMapping) {
            return $this->rememberUnavailable($cacheKey);
        }

        $details = $this->tmdbService->getDetails($mapping->tmdb_id, $mapping->tmdb_type);

        if ($details === null) {
            return $this->rememberUnavailable($cacheKey);
        }

        $result = [
            'poster_url' => $this->tmdbService->posterUrl($details['poster_path'] ?? $mapping->poster_path),
            'backdrop_url' => $this->tmdbService->backdropUrl($details['backdrop_path'] ?? $mapping->backdrop_path),
            'overview' => $details['overview'],
            'vote_average' => $details['vote_average'],
            'runtime' => $details['runtime'],
            'cast' => $details['cast'],
            'trailer_key' => $details['trailer_key'],
            'tmdb_available' => true,
        ];

        Cache::put($cacheKey, $result, now()->addHours($this->cacheTtlHours()));

        return $result;
    }

    // ======= Card Metadata Bulk Lookup (Recommendations / Home / Favorites / History) =======

    /**
     * Lightweight enrichment for lists/cards: poster_url + vote_average only
     * — never the full resolve() payload (overview/cast/trailer/runtime),
     * which would mean one details call per item instead of one shared
     * batch search. A Cache or DB hit never calls TMDB at all for
     * poster_url (poster_path is stored directly on the mapping row); only
     * titles that are cache- and DB-misses are searched, and those searches
     * fire in parallel via TmdbService::findManyByTitle() rather than one
     * at a time.
     *
     * vote_average is intentionally *not* persisted to title_tmdb_mappings
     * (unlike poster_path/backdrop_path) — a rating drifts over time the
     * way an image path never does, so it's only ever cached, alongside
     * poster_url, with the same TTL as everything else TMDB. One real
     * consequence: a DB hit (mapping already known, search skipped) has no
     * fresh source for vote_average once its cache entry expires, and
     * returns null for it rather than paying for an extra request just for
     * a rating on a card. poster_url is unaffected either way.
     *
     * Known limitation: the result (and internal batching) is keyed by
     * title alone, matching how every current caller (RecommendationItemResource,
     * HomeService::attachCardMetadata, FavoriteController, WatchedTitleController)
     * looks metadata back up — by `$item['title']`, not `(title, release_year)`.
     * Two entries sharing the exact same title string but a different
     * release_year within a *single* batch would collide onto one key.
     * Deliberately not fixed here: no current caller keys its own lookup by
     * year either, ML result sets don't emit the same title twice in one
     * response, and resolve() (Title Details, where a specific title+year
     * is requested directly) is unaffected. Would need release_year
     * threaded through every caller's lookup too if this ever becomes a
     * real requirement.
     *
     * @param  array<int, array{title: string, release_year: ?int, type: TmdbMediaType}>  $titles
     * @return array<string, array{poster_url: ?string, vote_average: ?float}> keyed by title
     */
    public function getCardMetadataForTitles(array $titles): array
    {
        $results = [];
        $pending = [];

        foreach ($titles as $entry) {
            $cacheKey = $this->cardMetadataCacheKey($entry['title'], $entry['release_year']);

            if (Cache::has($cacheKey)) {
                $results[$entry['title']] = Cache::get($cacheKey);

                continue;
            }

            $pending[$entry['title']] = ['entry' => $entry, 'cache_key' => $cacheKey];
        }

        if ($pending === []) {
            return $results;
        }

        $mappedEntries = array_map(fn (array $p): array => $p['entry'], $pending);
        $existingMappings = $this->matchExistingMappings($mappedEntries);

        $stillPending = [];

        foreach ($pending as $title => $p) {
            $mapping = $existingMappings[$title] ?? null;

            if ($mapping instanceof TitleTmdbMapping) {
                $metadata = ['poster_url' => $this->tmdbService->posterUrl($mapping->poster_path), 'vote_average' => null];
                Cache::put($p['cache_key'], $metadata, now()->addHours($this->cacheTtlHours()));
                $results[$title] = $metadata;

                continue;
            }

            $stillPending[$title] = $p;
        }

        if ($stillPending === []) {
            return $results;
        }

        $searchEntries = array_map(fn (array $p): array => $p['entry'], $stillPending);
        $matches = $this->tmdbService->findManyByTitle($searchEntries);

        foreach ($stillPending as $title => $p) {
            $match = $matches[$title] ?? null;
            $metadata = ['poster_url' => null, 'vote_average' => null];

            if ($match !== null) {
                $this->persistMapping($title, $p['entry']['release_year'], $p['entry']['type'], $match);
                $metadata = [
                    'poster_url' => $this->tmdbService->posterUrl($match['poster_path']),
                    'vote_average' => $match['vote_average'],
                ];
            }

            Cache::put(
                $p['cache_key'],
                $metadata,
                now()->addHours($match !== null ? $this->cacheTtlHours() : self::NEGATIVE_CACHE_TTL_HOURS),
            );

            $results[$title] = $metadata;
        }

        return $results;
    }

    // ======= Matching + Persistence =======

    private function findOrCreateMapping(string $title, ?int $releaseYear, TmdbMediaType $type): ?TitleTmdbMapping
    {
        $existing = TitleTmdbMapping::query()
            ->where('title_name', $title)
            ->where('release_year', $releaseYear)
            ->first();

        if ($existing instanceof TitleTmdbMapping) {
            return $existing;
        }

        $match = $this->tmdbService->findByTitle($title, $releaseYear, $type);

        if ($match === null) {
            return null;
        }

        return $this->persistMapping($title, $releaseYear, $type, $match);
    }

    /**
     * Single query for every pending title (whereIn), matched back to its
     * exact (title, release_year) pair in memory — avoids N+1 queries, and
     * avoids collapsing duplicate titles (e.g. "The Office" US/UK, or a
     * remake with a different release_year) onto the wrong row.
     *
     * @param  array<int, array{title: string, release_year: ?int, type: TmdbMediaType}>  $entries
     * @return array<string, TitleTmdbMapping> keyed by title
     */
    private function matchExistingMappings(array $entries): array
    {
        $rows = TitleTmdbMapping::query()
            ->whereIn('title_name', array_column($entries, 'title'))
            ->get();

        $results = [];

        foreach ($entries as $entry) {
            $row = $rows->first(fn (TitleTmdbMapping $mapping): bool => $mapping->title_name === $entry['title']
                && $mapping->release_year === $entry['release_year']
            );

            if ($row instanceof TitleTmdbMapping) {
                $results[$entry['title']] = $row;
            }
        }

        return $results;
    }

    /**
     * @param  array{tmdb_id: int, poster_path: ?string, backdrop_path: ?string}  $match
     */
    private function persistMapping(string $title, ?int $releaseYear, TmdbMediaType $type, array $match): TitleTmdbMapping
    {
        return TitleTmdbMapping::query()->updateOrCreate(
            ['title_name' => $title, 'release_year' => $releaseYear],
            [
                'tmdb_id' => $match['tmdb_id'],
                'tmdb_type' => $type,
                'poster_path' => $match['poster_path'],
                'backdrop_path' => $match['backdrop_path'],
            ],
        );
    }

    // ======= Cache Keys & Helpers =======

    private function detailsCacheKey(string $title, ?int $releaseYear): string
    {
        return 'tmdb:details:'.mb_strtolower($title).':'.($releaseYear ?? 'unknown');
    }

    private function cardMetadataCacheKey(string $title, ?int $releaseYear): string
    {
        return 'tmdb:card:'.mb_strtolower($title).':'.($releaseYear ?? 'unknown');
    }

    private function cacheTtlHours(): int
    {
        return (int) config('services.tmdb.cache_ttl_hours');
    }

    /**
     * The shape returned whenever TMDB enrichment couldn't be resolved —
     * a safe default callers can merge in directly. Also used by
     * TitleController when the ML type label itself can't even be mapped
     * to TMDB's movie/tv vocabulary, without needing a cache key for it.
     *
     * @return array{poster_url: null, backdrop_url: null, overview: null, vote_average: null, runtime: null, cast: array<empty, empty>, trailer_key: null, tmdb_available: false}
     */
    public function unavailable(): array
    {
        return [
            'poster_url' => null,
            'backdrop_url' => null,
            'overview' => null,
            'vote_average' => null,
            'runtime' => null,
            'cast' => [],
            'trailer_key' => null,
            'tmdb_available' => false,
        ];
    }

    /**
     * @return array{poster_url: null, backdrop_url: null, overview: null, vote_average: null, runtime: null, cast: array<empty, empty>, trailer_key: null, tmdb_available: false}
     */
    private function rememberUnavailable(string $cacheKey): array
    {
        $result = $this->unavailable();

        Cache::put($cacheKey, $result, now()->addHours(self::NEGATIVE_CACHE_TTL_HOURS));

        return $result;
    }
}
