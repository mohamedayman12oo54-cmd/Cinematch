<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Throwable;

/**
 * The HTTP bridge between the Laravel backend and the ML model (ml/recommender_service.py).
 * Never called directly by the client — only by this application's controllers/services.
 */
class MLClientService
{
    // ======= Autocomplete =======

    /**
     * @return array<int, array{title: string, type: string, release_year: int}>
     */
    public function search(string $query, int $limit = 12): array
    {
        $response = $this->get('/api/search', ['q' => $query, 'limit' => $limit]);

        return $response->json('results') ?? [];
    }

    // ======= Title Detail =======

    /**
     * @return array{title: string, type: string, genres: string, rating: string, country: string, release_year: int, director: string}|null
     */
    public function getTitleDetail(string $title): ?array
    {
        $response = $this->get("/api/titles/{$title}");

        return $response->status() === 404 ? null : $response->json();
    }

    // ======= Recommendations =======

    /**
     * @return array{query: string, matched_title: string, total: int, results: array<int, array<string, mixed>>}|null
     */
    public function getRecommendations(string $title, int $n = 10): ?array
    {
        $response = $this->get("/api/recommend/{$title}", ['n' => $n]);

        return $response->status() === 404 ? null : $response->json();
    }

    // ======= Batch Lookups (Home Feature) =======

    /**
     * Resolve full metadata for many titles at once — the results are stable
     * (the dataset doesn't change minute to minute), so each title is cached
     * independently for 24h and only cache misses are ever sent to the ML
     * service, in parallel, via Http::pool().
     *
     * @param  array<int, string>  $titles
     * @return array<string, array{title: string, type: string, genres: string, rating: string, country: string, release_year: int, director: string}|null> keyed by the input title
     */
    public function getManyTitleDetails(array $titles): array
    {
        return $this->poolCached(
            titles: $titles,
            cacheKeyPrefix: 'ml:title',
            uriFor: fn (string $title): string => "/api/titles/{$title}",
            queryFor: fn (string $title): array => [],
        );
    }

    /**
     * Resolve recommendations for many seed titles at once — same caching
     * and parallelism rationale as getManyTitleDetails().
     *
     * @param  array<int, string>  $titles
     * @return array<string, array{query: string, matched_title: string, total: int, results: array<int, array<string, mixed>>}|null> keyed by the input title
     */
    public function getManyRecommendations(array $titles, int $n = 10): array
    {
        return $this->poolCached(
            titles: $titles,
            cacheKeyPrefix: "ml:recommendations:n={$n}",
            uriFor: fn (string $title): string => "/api/recommend/{$title}",
            queryFor: fn (string $title): array => ['n' => $n],
        );
    }

    /**
     * @param  array<int, string>  $titles
     * @param  callable(string): string  $uriFor
     * @param  callable(string): array<string, mixed>  $queryFor
     * @return array<string, array<string, mixed>|null>
     */
    private function poolCached(array $titles, string $cacheKeyPrefix, callable $uriFor, callable $queryFor): array
    {
        $titles = array_values(array_unique($titles));
        $results = [];
        $pending = [];

        foreach ($titles as $title) {
            $cacheKey = "{$cacheKeyPrefix}:{$title}";

            if (Cache::has($cacheKey)) {
                $results[$title] = Cache::get($cacheKey);
            } else {
                $pending[$title] = $cacheKey;
            }
        }

        if ($pending === []) {
            return $results;
        }

        try {
            /** @var array<string, Response|ConnectionException> $responses */
            $responses = Http::pool(fn (Pool $pool): array => collect($pending)
                ->map(fn (string $cacheKey, string $title) => $pool->as($title)
                    ->baseUrl(config('services.ml.base_url'))
                    ->timeout(config('services.ml.timeout'))
                    ->get($uriFor($title), $queryFor($title)))
                ->all());
        } catch (Throwable) {
            // The whole pool is unreachable — every pending title degrades
            // to null rather than failing the caller (Home must never 5xx
            // just because the ML service happens to be down).
            foreach (array_keys($pending) as $title) {
                $results[$title] = null;
            }

            return $results;
        }

        foreach ($pending as $title => $cacheKey) {
            $response = $responses[$title] ?? null;
            $data = $response instanceof Response && $response->successful() ? $response->json() : null;

            if ($data !== null) {
                Cache::put($cacheKey, $data, now()->addHours(24));
            }

            $results[$title] = $data;
        }

        return $results;
    }

    // ======= HTTP =======

    /**
     * @param  array<string, mixed>  $query
     */
    private function get(string $uri, array $query = []): Response
    {
        try {
            $response = $this->client()->get($uri, $query);
        } catch (ConnectionException $e) {
            if (str_contains(strtolower($e->getMessage()), 'timed out') || str_contains(strtolower($e->getMessage()), 'timeout')) {
                throw new MlTimeoutException('The ML service took too long to respond.', $e->getCode(), previous: $e);
            }

            throw new MlConnectionException('The ML service is not available right now.', $e->getCode(), previous: $e);
        }

        if ($response->serverError() && $response->status() !== 404) {
            throw new MlConnectionException('The ML service is not available right now.');
        }

        return $response;
    }

    private function client(): PendingRequest
    {
        return Http::baseUrl(config('services.ml.base_url'))
            ->timeout(config('services.ml.timeout'));
    }
}
