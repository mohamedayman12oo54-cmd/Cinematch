<?php

declare(strict_types=1);

use App\Models\User;
use App\Models\WatchedTitle;

// ======= Helpers =======

function betterCallSaulMlDetail(): array
{
    return [
        'title' => 'Better Call Saul',
        'type' => 'TV Show',
        'genres' => 'Crime, Drama',
        'rating' => 'TV-MA',
        'country' => 'United States',
        'release_year' => 2015,
        'director' => 'Vince Gilligan',
    ];
}

// === GET HISTORY TESTS ===

test('an authenticated user can list their watch history newest first', function () {
    $user = User::factory()->create();
    $older = WatchedTitle::create([
        'user_id' => $user->id,
        'title_name' => 'Narcos',
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama',
        'release_year' => 2015,
        'watched_at' => now()->subDay(),
    ]);
    $newer = WatchedTitle::create([
        'user_id' => $user->id,
        'title_name' => 'Better Call Saul',
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama',
        'release_year' => 2015,
        'watched_at' => now(),
    ]);

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/history');

    $response->assertStatus(200)->assertJson(['status' => 'success']);

    expect($response->json('data.0.title_name'))->toBe($newer->title_name);
    expect($response->json('data.1.title_name'))->toBe($older->title_name);
    expect($response->json('data'))->toHaveCount(2);
});

test('a guest cannot list watch history', function () {
    $response = $this->getJson('/api/history');

    $response->assertStatus(401);
});

test('an authenticated user only sees their own watch history', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    WatchedTitle::create([
        'user_id' => $otherUser->id,
        'title_name' => 'Better Call Saul',
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama',
        'release_year' => 2015,
        'watched_at' => now(),
    ]);

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/history');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => [],
    ]);
});
