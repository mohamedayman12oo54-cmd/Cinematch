<?php

declare(strict_types=1);

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
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

// === REGULAR TESTS ===

test('a regular user sees personalized, because-you-watched, and popular sections in order', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());
    makeFavorite($user, 'Peaky Blinders', now()->subMinute());
    makeFavorite($user, 'The Witcher', now()->subMinutes(2));
    makeWatched($user, 'Mindhunter', now());
    makeWatched($user, 'Ozark', now()->subMinute());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Breaking Bad', 'Peaky Blinders', 'The Witcher'], 10)
            ->andReturn([
                'Breaking Bad' => homeMlRecommendation('Breaking Bad', [homeMlItem('Better Call Saul', 0.98)]),
                'Peaky Blinders' => homeMlRecommendation('Peaky Blinders', [homeMlItem('Taboo', 0.87)]),
                'The Witcher' => homeMlRecommendation('The Witcher', [homeMlItem('Dark', 0.9)]),
            ]);

        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Mindhunter'], 10)
            ->andReturn(['Mindhunter' => homeMlRecommendation('Mindhunter', [homeMlItem('Zodiac', 0.96, 'Movie', 2007)])]);

        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([
            'Narcos' => homeTitleDetail('Narcos'),
        ]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200)->assertJson(['status' => 'success', 'data' => ['stage' => 'regular']]);

    expect($response->json('data.sections'))->toHaveCount(3);
    expect($response->json('data.sections.0.type'))->toBe('personalized');
    expect($response->json('data.sections.0.title'))->toBe('Handpicked For You');
    expect($response->json('data.sections.1'))->toMatchArray([
        'type' => 'because_you_watched',
        'title' => 'Because You Watched Mindhunter',
        'seed_title' => 'Mindhunter',
    ]);
    expect($response->json('data.sections.1.items.0.title'))->toBe('Zodiac');
    expect($response->json('data.sections.2.type'))->toBe('popular');
});

test('signalCount of exactly five moves the user into the regular stage', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());
    makeWatched($user, 'Ozark', now());
    makeWatched($user, 'Dark', now()->subMinute());
    makeWatched($user, 'Narcos', now()->subMinutes(2));
    makeWatched($user, 'The Witcher', now()->subMinutes(3));

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')->twice()->andReturn([]);
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200)->assertJson(['status' => 'success', 'data' => ['stage' => 'regular']]);
});

test('a regular user with no favorites omits the personalized section', function () {
    $user = User::factory()->create();
    makeWatched($user, 'Mindhunter', now());
    makeWatched($user, 'Ozark', now()->subMinute());
    makeWatched($user, 'Dark', now()->subMinutes(2));
    makeWatched($user, 'Narcos', now()->subMinutes(3));
    makeWatched($user, 'The Witcher', now()->subMinutes(4));

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Mindhunter'], 10)
            ->andReturn(['Mindhunter' => homeMlRecommendation('Mindhunter', [homeMlItem('Zodiac', 0.96)])]);
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    expect($response->json('data.sections'))->toHaveCount(2);
    expect($response->json('data.sections.0.type'))->toBe('because_you_watched');
    expect($response->json('data.sections.1.type'))->toBe('popular');
});

test('a regular user with no watched titles omits the because-you-watched section', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());
    makeFavorite($user, 'Peaky Blinders', now()->subMinute());
    makeFavorite($user, 'The Witcher', now()->subMinutes(2));
    makeFavorite($user, 'Ozark', now()->subMinutes(3));
    makeFavorite($user, 'Dark', now()->subMinutes(4));

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Breaking Bad', 'Peaky Blinders', 'The Witcher'], 10)
            ->andReturn(['Breaking Bad' => homeMlRecommendation('Breaking Bad', [homeMlItem('Better Call Saul', 0.98)])]);
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    expect($response->json('data.sections'))->toHaveCount(2);
    expect($response->json('data.sections.0.type'))->toBe('personalized');
    expect($response->json('data.sections.1.type'))->toBe('popular');
});

// === LOYAL TESTS ===

test('a loyal user sees personalized (last 5), because-you-loved (top favorite), and new-for-you sections', function () {
    $user = User::factory()->create();
    // Newest first: Fav1 .. Fav10. The last 5 (Fav6..Fav10) are the "extra"
    // favorites used for New For You; Fav10 is the oldest = all-time top favorite.
    for ($i = 1; $i <= 10; $i++) {
        makeFavorite($user, "Fav{$i}", now()->subMinutes($i));
    }
    for ($i = 1; $i <= 10; $i++) {
        makeWatched($user, "Watched{$i}", now()->subMinutes($i));
    }

    $lastFiveSeeds = ['Fav1', 'Fav2', 'Fav3', 'Fav4', 'Fav5'];
    $extraSeeds = ['Fav6', 'Fav7', 'Fav8', 'Fav9', 'Fav10'];

    $this->mock(MLClientService::class, function ($mock) use ($lastFiveSeeds, $extraSeeds) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with($lastFiveSeeds, 10)
            ->andReturn(['Fav1' => homeMlRecommendation('Fav1', [homeMlItem('Handpicked Result', 0.9)])]);

        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Fav10'], 10)
            ->andReturn(['Fav10' => homeMlRecommendation('Fav10', [homeMlItem('Loved Result', 0.85)])]);

        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with($extraSeeds, 10)
            ->andReturn(['Fav6' => homeMlRecommendation('Fav6', [homeMlItem('New Result', 0.8)])]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200)->assertJson(['status' => 'success', 'data' => ['stage' => 'loyal']]);

    expect($response->json('data.sections'))->toHaveCount(3);
    expect($response->json('data.sections.0'))->toMatchArray(['type' => 'personalized', 'title' => 'Handpicked For You']);
    expect($response->json('data.sections.0.items.0.title'))->toBe('Handpicked Result');
    expect($response->json('data.sections.1'))->toMatchArray([
        'type' => 'because_you_loved',
        'title' => 'Because You Loved Fav10',
        'seed_title' => 'Fav10',
    ]);
    expect($response->json('data.sections.1.items.0.title'))->toBe('Loved Result');
    expect($response->json('data.sections.2'))->toMatchArray(['type' => 'new_for_you', 'title' => 'New For You']);
    expect($response->json('data.sections.2.items.0.title'))->toBe('New Result');
});

test('a loyal users new-for-you section falls back to popular seeds without enough extra favorites', function () {
    $user = User::factory()->create();
    for ($i = 1; $i <= 5; $i++) {
        makeFavorite($user, "Fav{$i}", now()->subMinutes($i));
    }
    for ($i = 1; $i <= 15; $i++) {
        makeWatched($user, "Watched{$i}", now()->subMinutes($i));
    }

    $fallbackSeeds = ['Breaking Bad', 'Stranger Things', 'The Crown'];

    $this->mock(MLClientService::class, function ($mock) use ($fallbackSeeds) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Fav1', 'Fav2', 'Fav3', 'Fav4', 'Fav5'], 10)
            ->andReturn([]);

        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Fav5'], 10)
            ->andReturn([]);

        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with($fallbackSeeds, 10)
            ->andReturn(['Breaking Bad' => homeMlRecommendation('Breaking Bad', [homeMlItem('Fallback Result', 0.7)])]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200);
    expect($response->json('data.sections.0.type'))->toBe('new_for_you');
    expect($response->json('data.sections.0.items.0.title'))->toBe('Fallback Result');
});

// === FILTERING TESTS ===

test('a favorited title is excluded from a personalized section', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());
    makeFavorite($user, 'Narcos', now()->subMinute());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Breaking Bad'], 10)
            ->andReturn(['Breaking Bad' => homeMlRecommendation('Breaking Bad', [
                homeMlItem('Better Call Saul', 0.98),
                homeMlItem('Narcos', 0.95),
            ])]);
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $titles = collect($response->json('data.sections.0.items'))->pluck('title');
    expect($titles)->toContain('Better Call Saul');
    expect($titles)->not->toContain('Narcos');
});

test('a watched title is excluded from a personalized section', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());
    makeWatched($user, 'Narcos', now());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Breaking Bad'], 10)
            ->andReturn(['Breaking Bad' => homeMlRecommendation('Breaking Bad', [
                homeMlItem('Better Call Saul', 0.98),
                homeMlItem('Narcos', 0.95),
            ])]);
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $titles = collect($response->json('data.sections.0.items'))->pluck('title');
    expect($titles)->toContain('Better Call Saul');
    expect($titles)->not->toContain('Narcos');
});

test('a watched title is excluded from the popular section', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());
    makeWatched($user, 'Ozark', now());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')->once()->andReturn([]);
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([
            'Ozark' => homeTitleDetail('Ozark'),
            'Dark' => homeTitleDetail('Dark'),
        ]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $popular = collect($response->json('data.sections'))->firstWhere('type', 'popular');
    $titles = collect($popular['items'])->pluck('title');
    expect($titles)->toContain('Dark');
    expect($titles)->not->toContain('Ozark');
});

test('empty ML recommendation results omit the personalized section entirely', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Breaking Bad'], 10)
            ->andReturn(['Breaking Bad' => homeMlRecommendation('Breaking Bad', [])]);
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    expect($response->json('data.sections'))->toHaveCount(1);
    expect($response->json('data.sections.0.type'))->toBe('popular');
});

// === RANKING TESTS ===

test('a title appearing across multiple seeds outranks a title appearing once, regardless of raw score', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());
    makeFavorite($user, 'Peaky Blinders', now()->subMinute());
    makeFavorite($user, 'The Witcher', now()->subMinutes(2));
    makeWatched($user, 'Mindhunter', now());
    makeWatched($user, 'Ozark', now()->subMinute());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Breaking Bad', 'Peaky Blinders', 'The Witcher'], 10)
            ->andReturn([
                'Breaking Bad' => homeMlRecommendation('Breaking Bad', [
                    homeMlItem('Narcos', 0.99),
                    homeMlItem('Taboo', 0.5),
                ]),
                'Peaky Blinders' => homeMlRecommendation('Peaky Blinders', [
                    homeMlItem('Zodiac', 0.95),
                ]),
                'The Witcher' => homeMlRecommendation('The Witcher', [
                    homeMlItem('Narcos', 0.8),
                ]),
            ]);

        $mock->shouldReceive('getManyRecommendations')->once()->with(['Mindhunter'], 10)->andReturn([]);
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $titles = collect($response->json('data.sections.0.items'))->pluck('title')->values()->all();

    // Narcos appears from 2 seeds (avg 0.895) → ranks first despite Zodiac's
    // single-appearance 0.95 being higher than either individual Narcos score.
    expect($titles[0])->toBe('Narcos');
    expect($titles)->toEqual(['Narcos', 'Zodiac', 'Taboo']);
});

// === ML UNAVAILABLE / INVALID RESPONSE TESTS ===

test('home still returns 200 with an empty popular section when ML is completely unreachable for a guest', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->once()->andThrow(new MlConnectionException);
    });

    $response = $this->getJson('/api/home');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => [
            'stage' => 'stranger',
            'sections' => [['type' => 'popular', 'title' => 'Popular on Netflix', 'items' => []]],
        ],
    ]);
});

test('home still returns 200 and degrades gracefully when ML is completely unreachable for a personalized user', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')->once()->andThrow(new MlConnectionException);
        $mock->shouldReceive('getManyTitleDetails')->once()->andThrow(new MlConnectionException);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200)->assertJson(['status' => 'success', 'data' => ['stage' => 'explorer']]);
    expect($response->json('data.sections'))->toHaveCount(1);
    expect($response->json('data.sections.0'))->toMatchArray(['type' => 'popular', 'items' => []]);
});

test('home still returns 200 when the ML service times out', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')->once()->andThrow(new MlTimeoutException);
        $mock->shouldReceive('getManyTitleDetails')->once()->andThrow(new MlTimeoutException);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200)->assertJson(['status' => 'success', 'data' => ['stage' => 'explorer']]);
});

test('a malformed ML recommendation response missing the results key is handled without error', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->andReturn(['Breaking Bad' => ['query' => 'Breaking Bad', 'matched_title' => 'Breaking Bad', 'total' => 0]]);
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200);
    expect($response->json('data.sections'))->toHaveCount(1);
    expect($response->json('data.sections.0.type'))->toBe('popular');
});

test('a null title-detail entry from ML is dropped from the popular section', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([
            'Breaking Bad' => homeTitleDetail('Breaking Bad'),
            'Stranger Things' => null,
        ]);
    });

    $response = $this->getJson('/api/home');

    $titles = collect($response->json('data.sections.0.items'))->pluck('title');
    expect($titles)->toContain('Breaking Bad');
    expect($titles)->not->toContain('Stranger Things');
});

// === RESPONSE STRUCTURE TESTS ===

test('the stranger response matches the documented json structure', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([
            'Breaking Bad' => homeTitleDetail('Breaking Bad', 'TV Show', 2008),
        ]);
    });

    $response = $this->getJson('/api/home');

    $response->assertStatus(200)->assertJsonStructure([
        'status',
        'data' => [
            'stage',
            'sections' => [
                '*' => ['type', 'title', 'items' => ['*' => ['title', 'type', 'release_year', 'similarity_score']]],
            ],
        ],
    ]);

    expect($response->json('data.sections.0'))->not->toHaveKey('seed_title');
});

test('a because_you_watched section carries a seed_title field that a personalized section does not', function () {
    $user = User::factory()->create();
    makeFavorite($user, 'Breaking Bad', now());
    makeFavorite($user, 'Peaky Blinders', now()->subMinute());
    makeFavorite($user, 'The Witcher', now()->subMinutes(2));
    makeWatched($user, 'Mindhunter', now());
    makeWatched($user, 'Ozark', now()->subMinute());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Breaking Bad', 'Peaky Blinders', 'The Witcher'], 10)
            ->andReturn(['Breaking Bad' => homeMlRecommendation('Breaking Bad', [homeMlItem('Better Call Saul', 0.98)])]);

        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Mindhunter'], 10)
            ->andReturn(['Mindhunter' => homeMlRecommendation('Mindhunter', [homeMlItem('Zodiac', 0.96, 'Movie', 2007)])]);

        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertJsonStructure([
        'data' => [
            'sections' => [
                '*' => ['type', 'title', 'items'],
            ],
        ],
    ]);

    $personalized = collect($response->json('data.sections'))->firstWhere('type', 'personalized');
    $becauseYouWatched = collect($response->json('data.sections'))->firstWhere('type', 'because_you_watched');

    expect($personalized)->not->toHaveKey('seed_title');
    expect($becauseYouWatched)->toHaveKey('seed_title');
    expect($becauseYouWatched['seed_title'])->toBe('Mindhunter');
});
