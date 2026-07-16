<?php

declare(strict_types=1);

use App\Enums\TmdbMediaType;
use App\Models\Favorite;
use App\Models\User;
use App\Models\WatchedTitle;
use App\Services\MLClientService;
use App\Services\TmdbMappingService;

// ======= Helpers =======

/**
 * @return array{title: string, type: string, genres: string, rating: string, country: string, release_year: int, director: string}
 */
function homeTmdbTitleDetail(string $title, string $type = 'TV Show', int $releaseYear = 2015): array
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
function homeTmdbMlItem(string $title, float $similarity, string $type = 'TV Show', int $releaseYear = 2015): array
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
function homeTmdbRecommendation(string $seedTitle, array $items): array
{
    return ['query' => $seedTitle, 'matched_title' => $seedTitle, 'total' => count($items), 'results' => $items];
}

function homeTmdbFavorite(User $user, string $title, DateTimeInterface $addedAt): Favorite
{
    return Favorite::create([
        'user_id' => $user->id, 'title_name' => $title, 'title_type' => 'tv_show',
        'genres' => 'Crime, Drama', 'release_year' => 2015, 'added_at' => $addedAt,
    ]);
}

function homeTmdbWatched(User $user, string $title, DateTimeInterface $watchedAt): WatchedTitle
{
    return WatchedTitle::create([
        'user_id' => $user->id, 'title_name' => $title, 'title_type' => 'tv_show',
        'genres' => 'Crime, Drama', 'release_year' => 2015, 'watched_at' => $watchedAt,
    ]);
}

// === POSTER ATTACHMENT ===

test('the guest popular section gets poster_url and vote_average attached per item, null when TMDB has no match', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([
            'Breaking Bad' => homeTmdbTitleDetail('Breaking Bad', 'TV Show', 2008),
            'Stranger Things' => homeTmdbTitleDetail('Stranger Things', 'TV Show', 2016),
        ]);
    });
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getCardMetadataForTitles')
            ->once()
            ->with([
                ['title' => 'Breaking Bad', 'release_year' => 2008, 'type' => TmdbMediaType::Tv],
                ['title' => 'Stranger Things', 'release_year' => 2016, 'type' => TmdbMediaType::Tv],
            ])
            ->andReturn(['Breaking Bad' => ['poster_url' => 'https://image.tmdb.org/t/p/w500/bb.jpg', 'vote_average' => 8.9]]);
    });

    $response = $this->getJson('/api/home');

    $items = collect($response->json('data.sections.0.items'))->keyBy('title');
    expect($items['Breaking Bad']['poster_url'])->toBe('https://image.tmdb.org/t/p/w500/bb.jpg');
    expect($items['Breaking Bad']['vote_average'])->toBe(8.9);
    expect($items['Stranger Things']['poster_url'])->toBeNull();
    expect($items['Stranger Things']['vote_average'])->toBeNull();
});

test('getCardMetadataForTitles is called exactly once for the whole feed, batching every section together', function () {
    $user = User::factory()->create();
    homeTmdbFavorite($user, 'Breaking Bad', now());
    homeTmdbFavorite($user, 'Peaky Blinders', now()->subMinute());
    homeTmdbFavorite($user, 'The Witcher', now()->subMinutes(2));
    homeTmdbWatched($user, 'Mindhunter', now());
    homeTmdbWatched($user, 'Ozark', now()->subMinute());

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Breaking Bad', 'Peaky Blinders', 'The Witcher'], 10)
            ->andReturn(['Breaking Bad' => homeTmdbRecommendation('Breaking Bad', [homeTmdbMlItem('Better Call Saul', 0.98)])]);

        $mock->shouldReceive('getManyRecommendations')
            ->once()
            ->with(['Mindhunter'], 10)
            ->andReturn(['Mindhunter' => homeTmdbRecommendation('Mindhunter', [homeTmdbMlItem('Zodiac', 0.96, 'Movie', 2007)])]);

        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([
            'Narcos' => homeTmdbTitleDetail('Narcos', 'TV Show', 2015),
        ]);
    });

    // One call covering all 3 sections' items (Better Call Saul, Zodiac, Narcos)
    // — not one call per section — is exactly what this test enforces via ->once().
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getCardMetadataForTitles')
            ->once()
            ->with([
                ['title' => 'Better Call Saul', 'release_year' => 2015, 'type' => TmdbMediaType::Tv],
                ['title' => 'Zodiac', 'release_year' => 2007, 'type' => TmdbMediaType::Movie],
                ['title' => 'Narcos', 'release_year' => 2015, 'type' => TmdbMediaType::Tv],
            ])
            ->andReturn([
                'Better Call Saul' => ['poster_url' => 'https://img/bcs.jpg', 'vote_average' => 8.7],
                'Zodiac' => ['poster_url' => 'https://img/zodiac.jpg', 'vote_average' => 7.7],
                'Narcos' => ['poster_url' => 'https://img/narcos.jpg', 'vote_average' => 8.8],
            ]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/home');

    $response->assertStatus(200)->assertJson(['data' => ['stage' => 'regular']]);
    expect($response->json('data.sections'))->toHaveCount(3);

    $allItems = collect($response->json('data.sections'))->flatMap(fn (array $s) => $s['items'])->keyBy('title');
    expect($allItems['Better Call Saul']['poster_url'])->toBe('https://img/bcs.jpg');
    expect($allItems['Better Call Saul']['vote_average'])->toBe(8.7);
    expect($allItems['Zodiac']['poster_url'])->toBe('https://img/zodiac.jpg');
    expect($allItems['Narcos']['poster_url'])->toBe('https://img/narcos.jpg');
});

test('an item with a type label TMDB cannot map is excluded from the card metadata batch and gets nulls', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([
            'Breaking Bad' => homeTmdbTitleDetail('Breaking Bad', 'TV Show', 2008),
            'Some Special' => homeTmdbTitleDetail('Some Special', 'Documentary Short', 2020),
        ]);
    });
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getCardMetadataForTitles')
            ->once()
            ->with([['title' => 'Breaking Bad', 'release_year' => 2008, 'type' => TmdbMediaType::Tv]])
            ->andReturn(['Breaking Bad' => ['poster_url' => 'https://img/bb.jpg', 'vote_average' => 8.9]]);
    });

    $response = $this->getJson('/api/home');

    $items = collect($response->json('data.sections.0.items'))->keyBy('title');
    expect($items['Breaking Bad']['poster_url'])->toBe('https://img/bb.jpg');
    expect($items['Some Special']['poster_url'])->toBeNull();
    expect($items['Some Special']['vote_average'])->toBeNull();
});

test('getCardMetadataForTitles is never called when every section is empty', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getCardMetadataForTitles')->never();
    });

    $response = $this->getJson('/api/home');

    $response->assertStatus(200);
    expect($response->json('data.sections.0.items'))->toBe([]);
});
