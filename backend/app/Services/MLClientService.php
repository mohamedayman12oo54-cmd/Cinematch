<?php

declare(strict_types=1);

namespace App\Services;

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

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
