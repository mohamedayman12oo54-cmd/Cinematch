<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\TmdbMediaType;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The HTTP bridge to the public TMDB API (https://developer.themoviedb.org/).
 *
 * This is presentation-layer enrichment only — it must never become a hard
 * dependency of the recommendation pipeline. Every public method fails soft:
 * on any error (network, timeout, non-2xx, missing/malformed field) it logs
 * a warning and returns null rather than throwing, so a caller never needs
 * a try/catch around TMDB calls (docs/archeticutre_enhancement/10_Q8_EdgeCases.svg
 * — "Golden Rule: TMDB enrichment is always optional").
 *
 * Deliberately a plain class, not behind an interface (YAGNI — see
 * docs/archeticutre_enhancement/04_Q2_Interface.svg): introduce
 * MovieMetadataProvider only if/when a second metadata source is added.
 *
 * No caching lives here — that's TmdbMappingService's job. This class only
 * knows how to talk to TMDB.
 */
class TmdbService
{
    private const int YEAR_TOLERANCE = 1;

    // ======= Matching =======

    /**
     * Searches TMDB for the record matching a title (+ optional release
     * year for disambiguation — remakes, duplicate titles). Returns null if
     * nothing matched closely enough (docs/archeticutre_enhancement/
     * 10_Q8_EdgeCases.svg — wrong matches are treated as missing rather than
     * returned).
     *
     * TMDB's search response already includes poster_path/backdrop_path, so
     * this is returned alongside the id — callers that only need a poster
     * (bulk recommendations/home lookups) never need a second getDetails()
     * round trip just to get the image.
     *
     * @return array{tmdb_id: int, poster_path: ?string, backdrop_path: ?string}|null
     */
    public function findByTitle(string $title, ?int $releaseYear, TmdbMediaType $type): ?array
    {
        $response = $this->get('/search/'.$type->value, [
            'query' => $title,
            'include_adult' => false,
        ]);

        $candidates = $response?->json('results') ?? [];

        if ($candidates === []) {
            return null;
        }

        $match = $releaseYear === null
            ? $candidates[0]
            : $this->bestYearMatch($candidates, $releaseYear, $type);

        if ($match === null) {
            return null;
        }

        return [
            'tmdb_id' => $match['id'],
            'poster_path' => $match['poster_path'] ?? null,
            'backdrop_path' => $match['backdrop_path'] ?? null,
        ];
    }

    /**
     * Batch version of findByTitle() — fires one search request per entry in
     * parallel via Http::pool(), instead of N sequential round trips. Used
     * for poster-only bulk lookups (Recommendations/Home) where matching
     * many titles one at a time would multiply latency by the result count.
     *
     * @param  array<string, array{title: string, release_year: ?int, type: TmdbMediaType}>  $entries  keyed by caller-chosen key (e.g. the title itself)
     * @return array<string, array{tmdb_id: int, poster_path: ?string, backdrop_path: ?string}|null> keyed the same as $entries
     */
    public function findManyByTitle(array $entries): array
    {
        if ($entries === []) {
            return [];
        }

        if (blank(config('services.tmdb.token'))) {
            return array_fill_keys(array_keys($entries), null);
        }

        try {
            /** @var array<string, Response|ConnectionException> $responses */
            $responses = Http::pool(fn (Pool $pool): array => collect($entries)
                ->map(fn (array $entry, string $key) => $pool->as($key)
                    ->baseUrl(config('services.tmdb.base_url'))
                    ->withToken(config('services.tmdb.token'))
                    ->acceptJson()
                    ->timeout(config('services.tmdb.timeout'))
                    ->get('/search/'.$entry['type']->value, ['query' => $entry['title'], 'include_adult' => false]))
                ->all());
        } catch (Throwable $e) {
            Log::warning('TMDB batch search failed.', ['error' => $e->getMessage()]);

            return array_fill_keys(array_keys($entries), null);
        }

        $results = [];

        foreach ($entries as $key => $entry) {
            $response = $responses[$key] ?? null;
            $candidates = $response instanceof Response && $response->successful() ? ($response->json('results') ?? []) : [];

            if ($candidates === []) {
                $results[$key] = null;

                continue;
            }

            $match = $entry['release_year'] === null
                ? $candidates[0]
                : $this->bestYearMatch($candidates, $entry['release_year'], $entry['type']);

            $results[$key] = $match === null ? null : [
                'tmdb_id' => $match['id'],
                'poster_path' => $match['poster_path'] ?? null,
                'backdrop_path' => $match['backdrop_path'] ?? null,
            ];
        }

        return $results;
    }

    /**
     * @param  array<int, array<string, mixed>>  $candidates
     * @return array<string, mixed>|null
     */
    private function bestYearMatch(array $candidates, int $releaseYear, TmdbMediaType $type): ?array
    {
        $dateField = $type === TmdbMediaType::Movie ? 'release_date' : 'first_air_date';

        foreach ($candidates as $candidate) {
            $candidateYear = $this->yearFrom($candidate[$dateField] ?? null);

            if ($candidateYear !== null && abs($candidateYear - $releaseYear) <= self::YEAR_TOLERANCE) {
                return $candidate;
            }
        }

        return null;
    }

    private function yearFrom(?string $date): ?int
    {
        if ($date === null || $date === '') {
            return null;
        }

        return (int) substr($date, 0, 4);
    }

    // ======= Details =======

    /**
     * Full details for a known TMDB record — overview, vote_average, runtime,
     * poster/backdrop paths, top-5 cast, and trailer key, all in a single
     * request via append_to_response (avoids separate credits/videos calls).
     *
     * @return array{overview: ?string, vote_average: ?float, runtime: ?int, poster_path: ?string, backdrop_path: ?string, cast: array<int, string>, trailer_key: ?string}|null
     */
    public function getDetails(int $tmdbId, TmdbMediaType $type): ?array
    {
        $response = $this->get("/{$type->value}/{$tmdbId}", [
            'append_to_response' => 'credits,videos',
        ]);

        if ($response === null) {
            return null;
        }

        $data = $response->json();

        return [
            'overview' => $data['overview'] ?: null,
            'vote_average' => isset($data['vote_average']) ? (float) $data['vote_average'] : null,
            'runtime' => $this->runtimeFrom($data, $type),
            'poster_path' => $data['poster_path'] ?? null,
            'backdrop_path' => $data['backdrop_path'] ?? null,
            'cast' => $this->topCastFrom($data),
            'trailer_key' => $this->trailerKeyFrom($data),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function runtimeFrom(array $data, TmdbMediaType $type): ?int
    {
        if ($type === TmdbMediaType::Movie) {
            return $data['runtime'] ?? null;
        }

        return $data['episode_run_time'][0] ?? null;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<int, string>
     */
    private function topCastFrom(array $data): array
    {
        return collect($data['credits']['cast'] ?? [])
            ->take(5)
            ->pluck('name')
            ->all();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function trailerKeyFrom(array $data): ?string
    {
        return collect($data['videos']['results'] ?? [])
            ->first(fn (array $video): bool => ($video['site'] ?? null) === 'YouTube' && ($video['type'] ?? null) === 'Trailer'
            )['key'] ?? null;
    }

    /**
     * Convenience accessor — reuses getDetails() rather than a second
     * remote call, since videos are already fetched via append_to_response.
     */
    public function getTrailerKey(int $tmdbId, TmdbMediaType $type): ?string
    {
        return $this->getDetails($tmdbId, $type)['trailer_key'] ?? null;
    }

    // ======= Images =======

    public function posterUrl(?string $posterPath): ?string
    {
        return $this->imageUrl($posterPath, config('services.tmdb.poster_size'));
    }

    public function backdropUrl(?string $backdropPath): ?string
    {
        return $this->imageUrl($backdropPath, config('services.tmdb.backdrop_size'));
    }

    private function imageUrl(?string $path, string $size): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        return rtrim((string) config('services.tmdb.image_base_url'), '/')."/{$size}{$path}";
    }

    // ======= HTTP =======

    /**
     * @param  array<string, mixed>  $query
     */
    private function get(string $uri, array $query = []): ?Response
    {
        if (blank(config('services.tmdb.token'))) {
            return null;
        }

        try {
            $response = $this->client()->get($uri, $query);
        } catch (ConnectionException $e) {
            Log::warning('TMDB request failed — connection error.', ['uri' => $uri, 'error' => $e->getMessage()]);

            return null;
        } catch (Throwable $e) {
            Log::warning('TMDB request failed — unexpected error.', ['uri' => $uri, 'error' => $e->getMessage()]);

            return null;
        }

        if ($response->failed()) {
            Log::warning('TMDB request failed.', ['uri' => $uri, 'status' => $response->status()]);

            return null;
        }

        return $response;
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl(config('services.tmdb.base_url'))
            ->withToken(config('services.tmdb.token'))
            ->acceptJson()
            ->timeout(config('services.tmdb.timeout'));
    }
}
