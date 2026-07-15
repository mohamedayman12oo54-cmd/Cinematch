<?php

declare(strict_types=1);

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
use App\Models\Favorite;
use App\Models\User;
use App\Models\WatchedTitle;
use App\Services\MLClientService;
use App\Services\TmdbMappingService;

// TMDB enrichment is orthogonal to everything this file tests (ML wiring,
// user_signals, error mapping) — stub it to "unavailable" by default so
// every test here runs without ever touching the real TMDB API. TMDB
// merge/matching/fallback behavior itself is covered in
// TitleTmdbIntegrationTest.
beforeEach(function () {
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('resolve')->andReturn([
            'poster_url' => null,
            'backdrop_url' => null,
            'overview' => null,
            'vote_average' => null,
            'runtime' => null,
            'cast' => [],
            'trailer_key' => null,
            'tmdb_available' => false,
        ]);
        $mock->shouldReceive('getPostersForTitles')->andReturn([]);
    });
});

// ======= Helpers =======

function breakingBadDetail(): array
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

function breakingBadRecommendations(): array
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

// === TITLE DETAIL TESTS ===

test('a guest sees title detail without user_signals', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->with('Breaking Bad')->andReturn(breakingBadDetail());
    });

    $response = $this->getJson('/api/titles/Breaking%20Bad');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => [
            'title' => 'Breaking Bad',
            'type' => 'TV Show',
            'genres' => ['Crime', 'Drama', 'Thriller'],
            'rating' => 'TV-MA',
            'country' => 'United States',
            'release_year' => 2008,
            'director' => 'Vince Gilligan',
        ],
    ]);

    expect($response->json('data'))->not->toHaveKey('user_signals');
});

test('an authenticated user sees user_signals on title detail', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->with('Breaking Bad')->andReturn(breakingBadDetail());
    });

    $user = User::factory()->create();
    Favorite::create([
        'user_id' => $user->id,
        'title_name' => 'Breaking Bad',
        'title_type' => 'tv_show',
        'genres' => 'Crime,Drama,Thriller',
        'release_year' => 2008,
        'added_at' => now(),
    ]);
    $token = auth('api')->login($user);

    $response = $this->withToken($token)->getJson('/api/titles/Breaking%20Bad');

    $response->assertStatus(200)->assertJson([
        'data' => [
            'user_signals' => [
                'is_favorite' => true,
                'is_watched' => false,
            ],
        ],
    ]);
});

test('title detail returns 404 when the title is not found', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andReturn(null);
    });

    $response = $this->getJson('/api/titles/Nonexistent');

    $response->assertStatus(404)->assertJson([
        'status' => 'error',
        'message' => 'Title not found',
    ]);
});

test('title detail returns 503 when the ML service is unreachable', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andThrow(new MlConnectionException);
    });

    $response = $this->getJson('/api/titles/Breaking%20Bad');

    $response->assertStatus(503);
});

test('title detail returns 504 when the ML service times out', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andThrow(new MlTimeoutException);
    });

    $response = $this->getJson('/api/titles/Breaking%20Bad');

    $response->assertStatus(504);
});

// === RECOMMENDATIONS TESTS ===

test('a guest sees recommendations without user_signals', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getRecommendations')->once()->with('Breaking Bad', 10)->andReturn(breakingBadRecommendations());
    });

    $response = $this->getJson('/api/recommendations/Breaking%20Bad');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => [
            'query' => 'Breaking Bad',
            'matched_title' => 'Breaking Bad',
            'total' => 1,
            'results' => [
                [
                    'title' => 'Better Call Saul',
                    'type' => 'TV Show',
                    'release_year' => 2015,
                    'similarity_score' => 0.98,
                ],
            ],
        ],
    ]);

    expect($response->json('data.results.0'))->not->toHaveKey('user_signals');
});

test('an authenticated user sees user_signals on each recommendation', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getRecommendations')->once()->andReturn(breakingBadRecommendations());
    });

    $user = User::factory()->create();
    WatchedTitle::create([
        'user_id' => $user->id,
        'title_name' => 'Better Call Saul',
        'title_type' => 'tv_show',
        'genres' => 'Crime,Drama',
        'release_year' => 2015,
        'watched_at' => now(),
    ]);
    $token = auth('api')->login($user);

    $response = $this->withToken($token)->getJson('/api/recommendations/Breaking%20Bad');

    $response->assertStatus(200)->assertJson([
        'data' => [
            'results' => [
                [
                    'title' => 'Better Call Saul',
                    'user_signals' => [
                        'is_favorite' => false,
                        'is_watched' => true,
                    ],
                ],
            ],
        ],
    ]);
});

test('recommendations returns 404 when the title is not found', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getRecommendations')->once()->andReturn(null);
    });

    $response = $this->getJson('/api/recommendations/Nonexistent');

    $response->assertStatus(404)->assertJson([
        'status' => 'error',
        'message' => 'Title not found',
    ]);
});

test('recommendations returns 503 when the ML service is unreachable', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getRecommendations')->once()->andThrow(new MlConnectionException);
    });

    $response = $this->getJson('/api/recommendations/Breaking%20Bad');

    $response->assertStatus(503);
});
