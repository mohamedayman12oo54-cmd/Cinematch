<?php

declare(strict_types=1);

use App\Enums\TmdbMediaType;
use App\Models\Favorite;
use App\Models\User;
use App\Services\MLClientService;
use App\Services\TmdbMappingService;

// ======= Helpers =======

function favoriteTmdbBreakingBadDetail(): array
{
    return [
        'title' => 'Breaking Bad',
        'type' => 'TV Show',
        'genres' => 'Crime, Drama, Thriller',
        'rating' => 'TV-MA',
        'country' => 'United States',
        'release_year' => 2008,
        'director' => 'Vince Gilligan',
    ];
}

// === LIST FAVORITES: POSTER ATTACHMENT ===

test('listing favorites attaches poster_url per item from a single batched TMDB lookup', function () {
    $user = User::factory()->create();
    Favorite::create([
        'user_id' => $user->id, 'title_name' => 'Breaking Bad', 'title_type' => 'tv_show',
        'genres' => 'Crime, Drama', 'release_year' => 2008, 'added_at' => now(),
    ]);
    Favorite::create([
        'user_id' => $user->id, 'title_name' => 'Whiplash', 'title_type' => 'movie',
        'genres' => 'Drama', 'release_year' => 2014, 'added_at' => now()->subMinute(),
    ]);

    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getCardMetadataForTitles')
            ->once()
            ->with([
                ['title' => 'Breaking Bad', 'release_year' => 2008, 'type' => TmdbMediaType::Tv],
                ['title' => 'Whiplash', 'release_year' => 2014, 'type' => TmdbMediaType::Movie],
            ])
            ->andReturn([
                'Breaking Bad' => ['poster_url' => 'https://img/bb.jpg', 'vote_average' => 8.9],
                // Whiplash intentionally omitted — simulates no TMDB match.
            ]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/favorites');

    $response->assertStatus(200);
    $items = collect($response->json('data'))->keyBy('title_name');
    expect($items['Breaking Bad']['poster_url'])->toBe('https://img/bb.jpg');
    expect($items['Whiplash']['poster_url'])->toBeNull();

    // vote_average is deliberately not part of the Favorites contract — a
    // saved-list card doesn't need a rating the way a discovery card does.
    expect($items['Breaking Bad'])->not->toHaveKey('vote_average');
});

test('listing favorites never calls TmdbMappingService when the list is empty', function () {
    $user = User::factory()->create();

    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getCardMetadataForTitles')->never();
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/favorites');

    $response->assertStatus(200)->assertJson(['data' => [], 'meta' => ['total' => 0]]);
});

// === ADD FAVORITE: POSTER ATTACHMENT ===

test('adding a favorite includes its poster_url in the response', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->with('Breaking Bad')->andReturn(favoriteTmdbBreakingBadDetail());
    });
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getCardMetadataForTitles')
            ->once()
            ->with([['title' => 'Breaking Bad', 'release_year' => 2008, 'type' => TmdbMediaType::Tv]])
            ->andReturn(['Breaking Bad' => ['poster_url' => 'https://img/bb.jpg', 'vote_average' => 8.9]]);
    });

    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/favorites', [
        'title_name' => 'Breaking Bad',
    ]);

    $response->assertStatus(201)->assertJson([
        'data' => ['title_name' => 'Breaking Bad', 'poster_url' => 'https://img/bb.jpg'],
    ]);
});
