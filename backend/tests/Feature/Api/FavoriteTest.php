<?php

declare(strict_types=1);

use App\Exceptions\MlConnectionException;
use App\Models\Favorite;
use App\Models\User;
use App\Services\MLClientService;

// ======= Helpers =======

function breakingBadMlDetail(): array
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

// === GET FAVORITES TESTS ===

test('an authenticated user can list their favorites newest first', function () {
    $user = User::factory()->create();
    $older = Favorite::create([
        'user_id' => $user->id,
        'title_name' => 'Narcos',
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama',
        'release_year' => 2015,
        'added_at' => now()->subDay(),
    ]);
    $newer = Favorite::create([
        'user_id' => $user->id,
        'title_name' => 'Breaking Bad',
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama, Thriller',
        'release_year' => 2008,
        'added_at' => now(),
    ]);

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/favorites');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'meta' => ['total' => 2],
    ]);

    expect($response->json('data.0.title_name'))->toBe($newer->title_name);
    expect($response->json('data.1.title_name'))->toBe($older->title_name);
});

test('a guest cannot list favorites', function () {
    $response = $this->getJson('/api/favorites');

    $response->assertStatus(401);
});

test('an authenticated user only sees their own favorites', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();

    Favorite::create([
        'user_id' => $otherUser->id,
        'title_name' => 'Breaking Bad',
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama, Thriller',
        'release_year' => 2008,
        'added_at' => now(),
    ]);

    $response = $this->withToken(auth('api')->login($user))->getJson('/api/favorites');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => [],
        'meta' => ['total' => 0],
    ]);
});

// === ADD FAVORITE TESTS ===

test('an authenticated user can add a favorite', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->with('Breaking Bad')->andReturn(breakingBadMlDetail());
    });

    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/favorites', [
        'title_name' => 'Breaking Bad',
    ]);

    $response->assertStatus(201)->assertJson([
        'status' => 'success',
        'message' => 'Added to Favorites',
        'data' => [
            'title_name' => 'Breaking Bad',
            'title_type' => 'TV Show',
            'genres' => 'Crime, Drama, Thriller',
            'release_year' => 2008,
        ],
    ]);

    $this->assertDatabaseHas('favorites', [
        'user_id' => $user->id,
        'title_name' => 'Breaking Bad',
        'title_type' => 'tv_show',
    ]);
});

test('adding a favorite without a title_name fails validation', function () {
    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/favorites', []);

    $response->assertStatus(422)->assertJsonValidationErrors('title_name');
});

test('a guest cannot add a favorite', function () {
    $response = $this->postJson('/api/favorites', ['title_name' => 'Breaking Bad']);

    $response->assertStatus(401);
});

test('adding a title not found in the ML dataset returns 404', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andReturn(null);
    });

    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/favorites', [
        'title_name' => 'Nonexistent Show',
    ]);

    $response->assertStatus(404)->assertJson([
        'status' => 'error',
        'message' => 'Title not found',
    ]);
});

test('adding a duplicate favorite returns 422', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andReturn(breakingBadMlDetail());
    });

    $user = User::factory()->create();
    Favorite::create([
        'user_id' => $user->id,
        'title_name' => 'Breaking Bad',
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama, Thriller',
        'release_year' => 2008,
        'added_at' => now(),
    ]);

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/favorites', [
        'title_name' => 'Breaking Bad',
    ]);

    $response->assertStatus(422)->assertJson([
        'status' => 'error',
        'message' => 'Title already in your Favorites',
    ]);

    expect(Favorite::where('user_id', $user->id)->count())->toBe(1);
});

test('adding a favorite returns 503 when the ML service is unreachable', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andThrow(new MlConnectionException);
    });

    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->postJson('/api/favorites', [
        'title_name' => 'Breaking Bad',
    ]);

    $response->assertStatus(503)->assertJson([
        'status' => 'error',
        'message' => 'Service not available right now',
    ]);
});

// === DELETE FAVORITE TESTS ===

test('an authenticated user can remove a favorite', function () {
    $user = User::factory()->create();
    Favorite::create([
        'user_id' => $user->id,
        'title_name' => 'Breaking Bad',
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama, Thriller',
        'release_year' => 2008,
        'added_at' => now(),
    ]);

    $response = $this->withToken(auth('api')->login($user))->deleteJson('/api/favorites/Breaking Bad');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'message' => 'Removed from Favorites',
    ]);

    $this->assertDatabaseMissing('favorites', ['user_id' => $user->id, 'title_name' => 'Breaking Bad']);
});

test('removing a title not in favorites returns 404', function () {
    $user = User::factory()->create();

    $response = $this->withToken(auth('api')->login($user))->deleteJson('/api/favorites/Breaking Bad');

    $response->assertStatus(404)->assertJson([
        'status' => 'error',
        'message' => 'Title not in your Favorites',
    ]);
});

test('a user cannot remove another users favorite', function () {
    $user = User::factory()->create();
    $otherUser = User::factory()->create();
    Favorite::create([
        'user_id' => $otherUser->id,
        'title_name' => 'Breaking Bad',
        'title_type' => 'tv_show',
        'genres' => 'Crime, Drama, Thriller',
        'release_year' => 2008,
        'added_at' => now(),
    ]);

    $response = $this->withToken(auth('api')->login($user))->deleteJson('/api/favorites/Breaking Bad');

    $response->assertStatus(404);
    $this->assertDatabaseHas('favorites', ['user_id' => $otherUser->id, 'title_name' => 'Breaking Bad']);
});

test('a guest cannot remove a favorite', function () {
    $response = $this->deleteJson('/api/favorites/Breaking Bad');

    $response->assertStatus(401);
});
