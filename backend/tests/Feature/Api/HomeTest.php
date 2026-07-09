<?php

declare(strict_types=1);

use App\Models\Favorite;
use App\Models\User;
use App\Models\WatchedTitle;
use App\Services\MLClientService;

// ======= Helpers =======

/**
 * @return array{title: string, type: string, genres: string, rating: string, country: string, release_year: int, director: string}
 */
function homeTitleDetail(string $title, string $type = 'TV Show', int $releaseYear = 2015): array
{
    return [
        'title' => $title,
        'type' => $type,
        'genres' => 'Crime, Drama',
        'rating' => 'TV-MA',
        'country' => 'United States',
        'release_year' => $releaseYear,
        'director' => 'N/A',
    ];
}

/**
 * @return array{rank: int, title: string, type: string, genres: string, rating: string, country: string, release_year: int, director: string, similarity: float}
 */
function homeMlItem(string $title, float $similarity, string $type = 'TV Show', int $releaseYear = 2015): array
{
    return [
        'rank' => 1,
        'title' => $title,
        'type' => $type,
        'genres' => 'Crime, Drama',
        'rating' => 'TV-MA',
        'country' => 'United States',
        'release_year' => $releaseYear,
        'director' => 'N/A',
        'similarity' => $similarity,
    ];
}

/**
 * @param  array<int, array<string, mixed>>  $items
 * @return array{query: string, matched_title: string, total: int, results: array<int, array<string, mixed>>}
 */
function homeMlRecommendation(string $seedTitle, array $items): array
{
    return [
        'query' => $seedTitle,
        'matched_title' => $seedTitle,
        'total' => count($items),
        'results' => $items,
    ];
}

function makeFavorite(User $user, string $title, DateTimeInterface $addedAt): Favorite
{
    return Favorite::create([
        'user_id' => $user->id,
        'title_name' => $title,
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama',
        'release_year' => 2015,
        'added_at' => $addedAt,
    ]);
}

function makeWatched(User $user, string $title, DateTimeInterface $watchedAt): WatchedTitle
{
    return WatchedTitle::create([
        'user_id' => $user->id,
        'title_name' => $title,
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama',
        'release_year' => 2015,
        'watched_at' => $watchedAt,
    ]);
}

// === GUEST / STRANGER TESTS ===

test('a guest sees a stranger home with only a popular section', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([
            'Breaking Bad' => homeTitleDetail('Breaking Bad', 'TV Show', 2008),
            'Stranger Things' => homeTitleDetail('Stranger Things', 'TV Show', 2016),
        ]);
    });

    $response = $this->getJson('/api/home');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => [
            'stage' => 'stranger',
            'sections' => [
                [
                    'type' => 'popular',
                    'title' => 'Popular on Netflix',
                ],
            ],
        ],
    ]);

    expect($response->json('data.sections'))->toHaveCount(1);
    expect($response->json('data.sections.0.items.0.similarity_score'))->toBeNull();
});

test('an authenticated user with no signals sees the same stranger home', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([
            'Breaking Bad' => homeTitleDetail('Breaking Bad', 'TV Show', 2008),
        ]);
    });

    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => ['stage' => 'stranger'],
    ]);

    expect($response->json('data.sections'))->toHaveCount(1);
    expect($response->json('data.sections.0.type'))->toBe('popular');
});

test('an invalid or expired token degrades home to the guest experience', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withToken('not-a-real-token')->getJson('/api/home');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => ['stage' => 'stranger'],
    ]);
});

// === EXPLORER TESTS ===

test('an explorer with one favorite sees a personalized section seeded from it, plus popular', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Breaking Bad'], 10)
            ->andReturn(['Breaking Bad' => homeMlRecommendation('Breaking Bad', [
                homeMlItem('Better Call Saul', 0.98),
            ])]);
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([
            'Narcos' => homeTitleDetail('Narcos'),
        ]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200)->assertJson(['status' => 'success', 'data' => ['stage' => 'explorer']]);

    expect($response->json('data.sections'))->toHaveCount(2);
    expect($response->json('data.sections.0'))->toMatchArray([
        'type' => 'personalized',
        'title' => 'Based on Your Favorites',
    ]);
    expect($response->json('data.sections.0.items.0.title'))->toBe('Better Call Saul');
    expect($response->json('data.sections.1.type'))->toBe('popular');
});

test('an explorer with signals only from watched titles sees only the popular section', function () {
    $user = User::factory()->create();
    makeWatched($user, 'Narcos', now());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')->never();
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([
            'Breaking Bad' => homeTitleDetail('Breaking Bad'),
        ]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200)->assertJson(['status' => 'success', 'data' => ['stage' => 'explorer']]);
    expect($response->json('data.sections'))->toHaveCount(1);
    expect($response->json('data.sections.0.type'))->toBe('popular');
});

test('signalCount of exactly four keeps the user in the explorer stage', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());
    makeFavorite($user, 'Narcos', now()->subMinute());
    makeWatched($user, 'Ozark', now());
    makeWatched($user, 'Dark', now()->subMinute());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')->once()->andReturn([]);
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200)->assertJson(['status' => 'success', 'data' => ['stage' => 'explorer']]);
});
