<?php

declare(strict_types=1);

use App\Enums\TmdbMediaType;
use App\Services\MLClientService;
use App\Services\TmdbMappingService;

// ======= Helpers =======

/**
 * @return array{title: string, type: string, genres: string, rating: string, country: string, release_year: int, director: string}
 */
function tmdbIntegrationBreakingBadDetail(): array
{
    return [
        'title' => 'Breaking Bad',
        'type' => 'TV Show',
        'genres' => 'Crime,Drama,Thriller',
        'rating' => 'TV-MA',
        'country' => 'United States',
        'release_year' => 2008,
        'director' => 'Vince Gilligan',
    ];
}

/**
 * @return array{poster_url: string, backdrop_url: string, overview: string, vote_average: float, runtime: int, cast: array<int, string>, trailer_key: string, tmdb_available: bool}
 */
function tmdbAvailableResult(): array
{
    return [
        'poster_url' => 'https://image.tmdb.org/t/p/w500/poster.jpg',
        'backdrop_url' => 'https://image.tmdb.org/t/p/original/backdrop.jpg',
        'overview' => 'A high school chemistry teacher turned methamphetamine manufacturer.',
        'vote_average' => 8.9,
        'runtime' => 47,
        'cast' => ['Bryan Cranston', 'Aaron Paul', 'Anna Gunn'],
        'trailer_key' => 'HhesaQXLuRY',
        'tmdb_available' => true,
    ];
}

/**
 * @return array{poster_url: null, backdrop_url: null, overview: null, vote_average: null, runtime: null, cast: array<empty, empty>, trailer_key: null, tmdb_available: false}
 */
function tmdbUnavailableResult(): array
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
 * @return array{query: string, matched_title: string, total: int, results: array<int, array<string, mixed>>}
 */
function tmdbIntegrationBreakingBadRecommendations(): array
{
    return [
        'query' => 'Breaking Bad',
        'matched_title' => 'Breaking Bad',
        'total' => 1,
        'results' => [
            ['title' => 'Better Call Saul', 'type' => 'TV Show', 'release_year' => 2015, 'similarity' => 0.98],
        ],
    ];
}

// === TITLE DETAIL: TMDB MERGE ===

test('title detail merges full TMDB enrichment into the ML response', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andReturn(tmdbIntegrationBreakingBadDetail());
    });
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('resolve')->once()->with('Breaking Bad', 2008, TmdbMediaType::Tv)->andReturn(tmdbAvailableResult());
    });

    $response = $this->getJson('/api/titles/Breaking%20Bad');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => [
            'title' => 'Breaking Bad',
            'poster_url' => 'https://image.tmdb.org/t/p/w500/poster.jpg',
            'backdrop_url' => 'https://image.tmdb.org/t/p/original/backdrop.jpg',
            'overview' => 'A high school chemistry teacher turned methamphetamine manufacturer.',
            'vote_average' => 8.9,
            'runtime' => 47,
            'cast' => ['Bryan Cranston', 'Aaron Paul', 'Anna Gunn'],
            'trailer_key' => 'HhesaQXLuRY',
            'tmdb_available' => true,
        ],
    ]);
});

test('title detail degrades gracefully — ML fields stay intact, TMDB fields are null — when TMDB has no match', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andReturn(tmdbIntegrationBreakingBadDetail());
    });
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('resolve')->once()->andReturn(tmdbUnavailableResult());
    });

    $response = $this->getJson('/api/titles/Breaking%20Bad');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => [
            'title' => 'Breaking Bad',
            'type' => 'TV Show',
            'director' => 'Vince Gilligan',
            'poster_url' => null,
            'backdrop_url' => null,
            'overview' => null,
            'vote_average' => null,
            'runtime' => null,
            'cast' => [],
            'trailer_key' => null,
            'tmdb_available' => false,
        ],
    ]);
});

test('title detail returns tmdb_available false without ever calling TMDB when ML sends an unrecognized type label', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andReturn([
            ...tmdbIntegrationBreakingBadDetail(),
            'type' => 'Documentary Short', // not a label TitleType::fromLabel() recognizes
        ]);
    });
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('resolve')->never();
        $mock->shouldReceive('unavailable')->once()->andReturn(tmdbUnavailableResult());
    });

    $response = $this->getJson('/api/titles/Breaking%20Bad');

    $response->assertStatus(200)->assertJson(['data' => ['tmdb_available' => false]]);
});

// === RECOMMENDATIONS: POSTER MERGE ===

test('recommendations includes a poster_url per item from the batched TMDB lookup', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getRecommendations')->once()->andReturn(tmdbIntegrationBreakingBadRecommendations());
    });
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getPostersForTitles')
            ->once()
            ->with([['title' => 'Better Call Saul', 'release_year' => 2015, 'type' => TmdbMediaType::Tv]])
            ->andReturn(['Better Call Saul' => 'https://image.tmdb.org/t/p/w500/bcs.jpg']);
    });

    $response = $this->getJson('/api/recommendations/Breaking%20Bad');

    $response->assertStatus(200)->assertJson([
        'data' => [
            'results' => [
                ['title' => 'Better Call Saul', 'poster_url' => 'https://image.tmdb.org/t/p/w500/bcs.jpg'],
            ],
        ],
    ]);
});

test('recommendations sets poster_url null per item when the TMDB batch returns nothing', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getRecommendations')->once()->andReturn(tmdbIntegrationBreakingBadRecommendations());
    });
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getPostersForTitles')->once()->andReturn([]);
    });

    $response = $this->getJson('/api/recommendations/Breaking%20Bad');

    $response->assertStatus(200)->assertJson([
        'data' => ['results' => [['title' => 'Better Call Saul', 'poster_url' => null]]],
    ]);
});
