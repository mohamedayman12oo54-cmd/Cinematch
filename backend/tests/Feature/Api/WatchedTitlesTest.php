<?php

declare(strict_types=1);

use App\Exceptions\MlConnectionException;
use App\Models\User;
use App\Models\WatchedTitle;
use App\Services\MLClientService;

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

// === MARK AS WATCHED TESTS ===

test('an authenticated user can mark a title as watched', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->with('Better Call Saul')->andReturn(betterCallSaulMlDetail());
    });

    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/history', [
        'title_name' => 'Better Call Saul',
    ]);

    $response->assertStatus(201)->assertJson([
        'status' => 'success',
        'message' => 'Marked as Watched',
        'data' => [
            'title_name' => 'Better Call Saul',
            'title_type' => 'TV Show',
            'genres' => 'Crime, Drama',
            'release_year' => 2015,
        ],
    ]);

    $this->assertDatabaseHas('watched_titles', [
        'user_id' => $user->id,
        'title_name' => 'Better Call Saul',
        'title_type' => 'tv_show',
    ]);
});

test('marking a title watched without a title_name fails validation', function () {
    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/history', []);

    $response->assertStatus(422)->assertJsonValidationErrors('title_name');
});

test('a guest cannot mark a title as watched', function () {
    $response = $this->postJson('/api/history', ['title_name' => 'Better Call Saul']);

    $response->assertStatus(401);
});

test('marking a title not found in the ML dataset returns 404', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andReturn(null);
    });

    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/history', [
        'title_name' => 'Nonexistent Show',
    ]);

    $response->assertStatus(404)->assertJson([
        'status' => 'error',
        'message' => 'Title not found',
    ]);
});

test('marking a title as watched twice returns 422', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andReturn(betterCallSaulMlDetail());
    });

    $user = User::factory()->create();
    WatchedTitle::create([
        'user_id' => $user->id,
        'title_name' => 'Better Call Saul',
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama',
        'release_year' => 2015,
        'watched_at' => now(),
    ]);

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/history', [
        'title_name' => 'Better Call Saul',
    ]);

    $response->assertStatus(422)->assertJson([
        'status' => 'error',
        'message' => 'Title already in your Watch History',
    ]);

    expect(WatchedTitle::where('user_id', $user->id)->count())->toBe(1);
});

test('marking a title as watched returns 503 when the ML service is unreachable', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andThrow(new MlConnectionException);
    });

    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/history', [
        'title_name' => 'Better Call Saul',
    ]);

    $response->assertStatus(503)->assertJson([
        'status' => 'error',
        'message' => 'Service not available right now',
    ]);
});

// === REMOVE FROM HISTORY TESTS ===

test('an authenticated user can remove a title from their watch history', function () {
    $user = User::factory()->create();
    WatchedTitle::create([
        'user_id' => $user->id,
        'title_name' => 'Better Call Saul',
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama',
        'release_year' => 2015,
        'watched_at' => now(),
    ]);

    $response = $this->withToken(auth('api')->login($user))->deleteJson('/api/history/Better Call Saul');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'message' => 'Removed from Watch History',
    ]);

    $this->assertDatabaseMissing('watched_titles', ['user_id' => $user->id, 'title_name' => 'Better Call Saul']);
});

test('removing a title not in watch history returns 404', function () {
    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->deleteJson('/api/history/Better Call Saul');

    $response->assertStatus(404)->assertJson([
        'status' => 'error',
        'message' => 'Title not in your Watch History',
    ]);
});

test('a user cannot remove a title from another users watch history', function () {
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

    $response = $this->withToken(auth('api')->login($user))->deleteJson('/api/history/Better Call Saul');

    $response->assertStatus(404);
    $this->assertDatabaseHas('watched_titles', ['user_id' => $otherUser->id, 'title_name' => 'Better Call Saul']);
});

test('a guest cannot remove a title from watch history', function () {
    $response = $this->deleteJson('/api/history/Better Call Saul');

    $response->assertStatus(401);
});
