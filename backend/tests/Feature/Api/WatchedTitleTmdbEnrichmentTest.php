<?php

declare(strict_types=1);

use App\Enums\TmdbMediaType;
use App\Models\User;
use App\Models\WatchedTitle;
use App\Services\MLClientService;
use App\Services\TmdbMappingService;

// ======= Helpers =======

function watchedTmdbBetterCallSaulDetail(): array
{
    return [
        'title' => 'Better Call Saul',
        'type' => 'TV Show',
        'genres' => 'Crime, Drama',
        'rating' => 'TV-MA',
        'country' => 'United States',
        'release_year' => 2015,
        'director' => 'N/A',
    ];
}

// === LIST HISTORY: POSTER ATTACHMENT ===

test('listing watch history attaches poster_url per item from a single batched TMDB lookup', function () {
    $user = User::factory()->create();
    WatchedTitle::create([
        'user_id' => $user->id, 'title_name' => 'Better Call Saul', 'title_type' => 'tv_show',
        'genres' => 'Crime, Drama', 'release_year' => 2015, 'watched_at' => now(),
    ]);
    WatchedTitle::create([
        'user_id' => $user->id, 'title_name' => 'Whiplash', 'title_type' => 'movie',
        'genres' => 'Drama', 'release_year' => 2014, 'watched_at' => now()->subMinute(),
    ]);

    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getCardMetadataForTitles')
            ->once()
            ->with([
                ['title' => 'Better Call Saul', 'release_year' => 2015, 'type' => TmdbMediaType::Tv],
                ['title' => 'Whiplash', 'release_year' => 2014, 'type' => TmdbMediaType::Movie],
            ])
            ->andReturn([
                'Better Call Saul' => ['poster_url' => 'https://img/bcs.jpg', 'vote_average' => 8.7],
                // Whiplash intentionally omitted — simulates no TMDB match.
            ]);
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/history');

    $response->assertStatus(200);
    $items = collect($response->json('data'))->keyBy('title_name');
    expect($items['Better Call Saul']['poster_url'])->toBe('https://img/bcs.jpg');
    expect($items['Whiplash']['poster_url'])->toBeNull();
    expect($items['Better Call Saul'])->not->toHaveKey('vote_average');
});

test('listing watch history never calls TmdbMappingService when history is empty', function () {
    $user = User::factory()->create();

    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getCardMetadataForTitles')->never();
    });

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/history');

    $response->assertStatus(200)->assertJson(['data' => []]);
});

// === MARK WATCHED: POSTER ATTACHMENT ===

test('marking a title watched includes its poster_url in the response', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->with('Better Call Saul')->andReturn(watchedTmdbBetterCallSaulDetail());
    });
    $this->mock(TmdbMappingService::class, function ($mock) {
        $mock->shouldReceive('getCardMetadataForTitles')
            ->once()
            ->with([['title' => 'Better Call Saul', 'release_year' => 2015, 'type' => TmdbMediaType::Tv]])
            ->andReturn(['Better Call Saul' => ['poster_url' => 'https://img/bcs.jpg', 'vote_average' => 8.7]]);
    });

    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/history', [
        'title_name' => 'Better Call Saul',
    ]);

    $response->assertStatus(201)->assertJson([
        'data' => ['title_name' => 'Better Call Saul', 'poster_url' => 'https://img/bcs.jpg'],
    ]);
});
