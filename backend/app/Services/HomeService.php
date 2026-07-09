<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
use App\Models\Favorite;
use App\Models\User;
use App\Models\WatchedTitle;
use Illuminate\Support\Collection;

/**
 * Builds the personalized Home feed (docs/features/04_feature-home).
 *
 * The user's "stage" (stranger/explorer/regular/loyal) is derived at
 * request time from signalCount = favorites + watched titles — it is never
 * persisted, so it's always correct even the instant a signal changes.
 */
class HomeService
{
    private const int SECTION_ITEM_LIMIT = 10;

    /**
     * A curated, dataset-verified seed list used for the "Popular" section.
     * The ML service does not expose a popularity endpoint (see
     * ml/API_CONTRACT.md — only /api/search, /api/titles/{title} and
     * /api/recommend/{title} exist), so "popular" is implemented as real
     * title-detail lookups for well-known titles confirmed to exist in the
     * dataset, rather than an invented ranking signal.
     *
     * @var array<int, string>
     */
    private const array POPULAR_SEED_TITLES = [
        'Breaking Bad',
        'Stranger Things',
        'The Crown',
        'Narcos',
        'Ozark',
        'Better Call Saul',
        'Peaky Blinders',
        'House of Cards',
        'Dark',
        'The Witcher',
        'Black Mirror',
    ];

    public function __construct(private readonly MLClientService $mlClientService) {}

    // ======= Entry Point =======

    /**
     * @return array{stage: string, sections: array<int, array<string, mixed>>}
     */
    public function getHome(?User $user): array
    {
        if (! $user instanceof User) {
            return ['stage' => 'stranger', 'sections' => [$this->getPopularSection(collect(), collect())]];
        }

        $favorites = $user->favorites()->orderByDesc('added_at')->get();
        $watched = $user->watchedTitles()->orderByDesc('watched_at')->get();

        $stage = $this->resolveStage($favorites->count() + $watched->count());

        return [
            'stage' => $stage,
            'sections' => match ($stage) {
                'stranger' => [$this->getPopularSection($watched, $favorites)],
                'explorer' => $this->buildExplorerSections($favorites, $watched),
                'regular' => $this->buildRegularSections($favorites, $watched),
                'loyal' => $this->buildLoyalSections($favorites, $watched),
            },
        ];
    }

    // ======= Stage Resolution =======

    private function resolveStage(int $signalCount): string
    {
        return match (true) {
            $signalCount === 0 => 'stranger',
            $signalCount <= 4 => 'explorer',
            $signalCount <= 19 => 'regular',
            default => 'loyal',
        };
    }

    // ======= Stage Section Builders =======

    /**
     * @param  Collection<int, Favorite>  $favorites
     * @param  Collection<int, WatchedTitle>  $watched
     * @return array<int, array<string, mixed>>
     */
    private function buildExplorerSections(Collection $favorites, Collection $watched): array
    {
        $sections = [];

        $personalized = $this->getPersonalizedSection($favorites->take(1), $watched, $favorites, 'Based on Your Favorites');
        if ($personalized !== null) {
            $sections[] = $personalized;
        }

        $sections[] = $this->getPopularSection($watched, $favorites);

        return $sections;
    }

    /**
     * @param  Collection<int, Favorite>  $favorites
     * @param  Collection<int, WatchedTitle>  $watched
     * @return array<int, array<string, mixed>>
     */
    private function buildRegularSections(Collection $favorites, Collection $watched): array
    {
        $sections = [];

        $personalized = $this->getPersonalizedSection($favorites->take(3), $watched, $favorites, 'Handpicked For You');
        if ($personalized !== null) {
            $sections[] = $personalized;
        }

        $becauseYouWatched = $this->getBecauseYouWatchedSection($watched, $favorites);
        if ($becauseYouWatched !== null) {
            $sections[] = $becauseYouWatched;
        }

        $sections[] = $this->getPopularSection($watched, $favorites);

        return $sections;
    }

    /**
     * @param  Collection<int, Favorite>  $favorites
     * @param  Collection<int, WatchedTitle>  $watched
     * @return array<int, array<string, mixed>>
     */
    private function buildLoyalSections(Collection $favorites, Collection $watched): array
    {
        $seeds = $favorites->take(5);
        $sections = [];

        $personalized = $this->getPersonalizedSection($seeds, $watched, $favorites, 'Handpicked For You', $this->recencyWeights($seeds));
        if ($personalized !== null) {
            $sections[] = $personalized;
        }

        $becauseYouLoved = $this->getBecauseYouLovedSection($favorites, $watched);
        if ($becauseYouLoved !== null) {
            $sections[] = $becauseYouLoved;
        }

        $newForYou = $this->getNewForYouSection($favorites, $watched);
        if ($newForYou !== null) {
            $sections[] = $newForYou;
        }

        return $sections;
    }

    // ======= Sections =======

    /**
     * "Handpicked For You" / "Based on Your Favorites" — ML recommendations
     * seeded from the user's own Favorites, merged and ranked.
     *
     * @param  Collection<int, Favorite>  $seeds
     * @param  Collection<int, WatchedTitle>  $watched
     * @param  Collection<int, Favorite>  $favorites
     * @param  array<string, float>  $weights
     * @return array{type: string, title: string, items: array<int, array<string, mixed>>}|null
     */
    private function getPersonalizedSection(Collection $seeds, Collection $watched, Collection $favorites, string $title, array $weights = []): ?array
    {
        if ($seeds->isEmpty()) {
            return null;
        }

        $responses = $this->safeGetManyRecommendations($seeds->pluck('title_name')->all());
        $items = $this->rankAndFilter($responses, $watched, $favorites, $weights);

        if ($items === []) {
            return null;
        }

        return ['type' => 'personalized', 'title' => $title, 'items' => $items];
    }

    /**
     * "Because You Watched {last_watched}" — recommendations seeded from the
     * single most recently watched title.
     *
     * @param  Collection<int, WatchedTitle>  $watched
     * @param  Collection<int, Favorite>  $favorites
     * @return array{type: string, title: string, seed_title: string, items: array<int, array<string, mixed>>}|null
     */
    private function getBecauseYouWatchedSection(Collection $watched, Collection $favorites): ?array
    {
        $seedTitle = $watched->first()?->title_name;

        if ($seedTitle === null) {
            return null;
        }

        $responses = $this->safeGetManyRecommendations([$seedTitle]);
        $items = $this->rankAndFilter($responses, $watched, $favorites);

        if ($items === []) {
            return null;
        }

        return [
            'type' => 'because_you_watched',
            'title' => "Because You Watched {$seedTitle}",
            'seed_title' => $seedTitle,
            'items' => $items,
        ];
    }

    /**
     * "Because You Loved {top_favorite}" — recommendations seeded from the
     * user's all-time top Favorite (their first ever Favorite, the one
     * their taste has stayed anchored to the longest).
     *
     * @param  Collection<int, Favorite>  $favorites
     * @param  Collection<int, WatchedTitle>  $watched
     * @return array{type: string, title: string, seed_title: string, items: array<int, array<string, mixed>>}|null
     */
    private function getBecauseYouLovedSection(Collection $favorites, Collection $watched): ?array
    {
        $seedTitle = $favorites->last()?->title_name;

        if ($seedTitle === null) {
            return null;
        }

        $responses = $this->safeGetManyRecommendations([$seedTitle]);
        $items = $this->rankAndFilter($responses, $watched, $favorites);

        if ($items === []) {
            return null;
        }

        return [
            'type' => 'because_you_loved',
            'title' => "Because You Loved {$seedTitle}",
            'seed_title' => $seedTitle,
            'items' => $items,
        ];
    }

    /**
     * "New For You" (Loyal only) — fresh titles matching taste, seeded from
     * Favorites beyond the ones already used for "Handpicked For You" so
     * the two sections don't just repeat each other. Falls back to the
     * popular seed pool when the user doesn't have enough extra Favorites.
     *
     * @param  Collection<int, Favorite>  $favorites
     * @param  Collection<int, WatchedTitle>  $watched
     * @return array{type: string, title: string, items: array<int, array<string, mixed>>}|null
     */
    private function getNewForYouSection(Collection $favorites, Collection $watched): ?array
    {
        $extraSeeds = $favorites->slice(5, 5)->pluck('title_name')->all();
        $seedTitles = $extraSeeds !== [] ? $extraSeeds : array_slice(self::POPULAR_SEED_TITLES, 0, 3);

        $responses = $this->safeGetManyRecommendations($seedTitles);
        $items = $this->rankAndFilter($responses, $watched, $favorites);

        if ($items === []) {
            return null;
        }

        return ['type' => 'new_for_you', 'title' => 'New For You', 'items' => $items];
    }

    /**
     * "Popular on Netflix" — the cold-start-safe baseline shown to every
     * stage except Loyal. Never personalized (similarity_score is always
     * null), only filtered against what the user already knows.
     *
     * @param  Collection<int, WatchedTitle>  $watched
     * @param  Collection<int, Favorite>  $favorites
     * @return array{type: string, title: string, items: array<int, array<string, mixed>>}
     */
    private function getPopularSection(Collection $watched, Collection $favorites): array
    {
        $seen = $this->seenTitles($watched, $favorites);

        $items = collect($this->safeGetManyTitleDetails(self::POPULAR_SEED_TITLES))
            ->filter()
            ->reject(fn (array $detail): bool => in_array(mb_strtolower((string) $detail['title']), $seen, true))
            ->take(self::SECTION_ITEM_LIMIT)
            ->map(fn (array $detail): array => [
                'title' => $detail['title'],
                'type' => $detail['type'],
                'release_year' => $detail['release_year'],
                'similarity_score' => null,
            ])
            ->values()
            ->all();

        return ['type' => 'popular', 'title' => 'Popular on Netflix', 'items' => $items];
    }

    // ======= ML Access (Fail-Safe) =======

    /**
     * The Home feed must never fail the whole request just because the ML
     * service is unreachable or slow — a section with no data is simply
     * omitted (or, for "Popular", left empty) rather than surfacing a 5xx.
     *
     * @param  array<int, string>  $titles
     * @return array<string, array{query: string, matched_title: string, total: int, results: array<int, array<string, mixed>>}|null>
     */
    private function safeGetManyRecommendations(array $titles): array
    {
        try {
            return $this->mlClientService->getManyRecommendations($titles, self::SECTION_ITEM_LIMIT);
        } catch (MlConnectionException|MlTimeoutException) {
            return array_fill_keys($titles, null);
        }
    }

    /**
     * @param  array<int, string>  $titles
     * @return array<string, array{title: string, type: string, genres: string, rating: string, country: string, release_year: int, director: string}|null>
     */
    private function safeGetManyTitleDetails(array $titles): array
    {
        try {
            return $this->mlClientService->getManyTitleDetails($titles);
        } catch (MlConnectionException|MlTimeoutException) {
            return array_fill_keys($titles, null);
        }
    }

    // ======= Personalization Engine =======

    /**
     * Newest-first Favorites are weighted more heavily than older ones so a
     * recently added Favorite influences ranking more than a stale one.
     *
     * @param  Collection<int, Favorite>  $seedsNewestFirst
     * @return array<string, float>
     */
    private function recencyWeights(Collection $seedsNewestFirst): array
    {
        $count = $seedsNewestFirst->count();

        if ($count === 0) {
            return [];
        }

        return $seedsNewestFirst->values()
            ->mapWithKeys(fn (Favorite $favorite, int $index): array => [
                $favorite->title_name => 1.0 - ($index / $count) * 0.5,
            ])
            ->all();
    }

    /**
     * ML recommendations for every seed → merged, ranked, filtered against
     * already-seen titles, capped at the section item limit. This is the
     * shared pipeline behind every recommendation-driven section.
     *
     * @param  array<string, array{query: string, matched_title: string, total: int, results: array<int, array<string, mixed>>}|null>  $responsesBySeed
     * @param  Collection<int, WatchedTitle>  $watched
     * @param  Collection<int, Favorite>  $favorites
     * @param  array<string, float>  $weights
     * @return array<int, array<string, mixed>>
     */
    private function rankAndFilter(array $responsesBySeed, Collection $watched, Collection $favorites, array $weights = []): array
    {
        $ranked = $this->mergeAndRankResults($responsesBySeed, $weights);
        $filtered = $this->filterSeenTitles($ranked, $watched, $favorites);

        return collect($filtered)
            ->take(self::SECTION_ITEM_LIMIT)
            ->map(fn (array $entry): array => [
                'title' => $entry['item']['title'],
                'type' => $entry['item']['type'],
                'release_year' => $entry['item']['release_year'],
                'similarity_score' => round($entry['avg_score'], 4),
            ])
            ->values()
            ->all();
    }

    /**
     * Merges recommendation results from multiple seeds into one ranked
     * list: a title that appears from several seeds outranks one that only
     * appeared once, and ties break on (weighted) average similarity.
     *
     * @param  array<string, array{results: array<int, array<string, mixed>>}|null>  $responsesBySeed
     * @param  array<string, float>  $weights
     * @return array<int, array{item: array<string, mixed>, count: int, avg_score: float}>
     */
    private function mergeAndRankResults(array $responsesBySeed, array $weights = []): array
    {
        $merged = [];

        foreach ($responsesBySeed as $seedTitle => $response) {
            if ($response === null) {
                continue;
            }

            $weight = $weights[$seedTitle] ?? 1.0;

            foreach ($response['results'] ?? [] as $item) {
                $key = mb_strtolower((string) $item['title']);

                $merged[$key] ??= ['item' => $item, 'count' => 0, 'weightedScoreSum' => 0.0];
                $merged[$key]['count']++;
                $merged[$key]['weightedScoreSum'] += ((float) ($item['similarity'] ?? 0.0)) * $weight;
            }
        }

        $ranked = array_map(fn (array $entry): array => [
            'item' => $entry['item'],
            'count' => $entry['count'],
            'avg_score' => $entry['weightedScoreSum'] / $entry['count'],
        ], $merged);

        usort($ranked, fn (array $a, array $b): int => $b['count'] <=> $a['count'] ?: $b['avg_score'] <=> $a['avg_score']);

        return array_values($ranked);
    }

    /**
     * Titles the user has already watched or favorited are excluded from
     * every recommendation-driven section — no point suggesting what
     * they've already seen or saved.
     *
     * @param  array<int, array{item: array<string, mixed>, count: int, avg_score: float}>  $rankedEntries
     * @param  Collection<int, WatchedTitle>  $watched
     * @param  Collection<int, Favorite>  $favorites
     * @return array<int, array{item: array<string, mixed>, count: int, avg_score: float}>
     */
    private function filterSeenTitles(array $rankedEntries, Collection $watched, Collection $favorites): array
    {
        $seen = $this->seenTitles($watched, $favorites);

        return array_values(array_filter(
            $rankedEntries,
            fn (array $entry): bool => ! in_array(mb_strtolower((string) $entry['item']['title']), $seen, true),
        ));
    }

    /**
     * @param  Collection<int, WatchedTitle>  $watched
     * @param  Collection<int, Favorite>  $favorites
     * @return array<int, string>
     */
    private function seenTitles(Collection $watched, Collection $favorites): array
    {
        return $watched->pluck('title_name')
            ->merge($favorites->pluck('title_name'))
            ->map(fn (string $title): string => mb_strtolower($title))
            ->unique()
            ->values()
            ->all();
    }
}
