<?php

declare(strict_types=1);

use App\Models\Favorite;
use App\Models\User;

// ======= Helpers =======

function registerPayload(array $overrides = []): array
{
    return array_merge([
        'email' => fake()->unique()->safeEmail(),
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ], $overrides);
}

// === REGISTER TESTS ===

test('a user can register and receives a token immediately', function () {
    $response = $this->postJson('/api/auth/register', registerPayload(['email' => 'ahmed@example.com']));

    $response->assertStatus(201)
        ->assertJson([
            'status' => 'success',
            'message' => 'Account created',
        ])
        ->assertJsonStructure([
            'status',
            'message',
            'data' => ['user' => ['id', 'email', 'stage'], 'token', 'token_type', 'expires_in'],
        ]);

    expect($response->json('data.user.email'))->toBe('ahmed@example.com');
    expect($response->json('data.user.stage'))->toBe('stranger');
    expect($response->json('data.token_type'))->toBe('bearer');

    $this->assertDatabaseHas('users', ['email' => 'ahmed@example.com']);
});

test('registering with a duplicate email fails validation', function () {
    User::factory()->create(['email' => 'ahmed@example.com']);

    $response = $this->postJson('/api/auth/register', registerPayload(['email' => 'ahmed@example.com']));

    $response->assertStatus(422)->assertJsonValidationErrors('email');
});

test('registering with a short password fails validation', function () {
    $response = $this->postJson('/api/auth/register', registerPayload([
        'password' => 'short',
        'password_confirmation' => 'short',
    ]));

    $response->assertStatus(422)->assertJsonValidationErrors('password');
});

test('registering with a mismatched password confirmation fails validation', function () {
    $response = $this->postJson('/api/auth/register', registerPayload([
        'password' => 'password123',
        'password_confirmation' => 'something-else',
    ]));

    $response->assertStatus(422)->assertJsonValidationErrors('password');
});

// === LOGIN TESTS ===

test('a user can login with correct credentials', function () {
    User::factory()->create([
        'email' => 'ahmed@example.com',
        'password' => 'password123',
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'ahmed@example.com',
        'password' => 'password123',
    ]);

    $response->assertStatus(200)
        ->assertJson(['status' => 'success'])
        ->assertJsonStructure([
            'status',
            'data' => ['user' => ['id', 'email', 'stage'], 'token', 'token_type', 'expires_in'],
        ]);
});

test('login fails with an incorrect password', function () {
    User::factory()->create([
        'email' => 'ahmed@example.com',
        'password' => 'password123',
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'ahmed@example.com',
        'password' => 'wrong-password',
    ]);

    $response->assertStatus(401)->assertJson([
        'status' => 'error',
        'message' => 'Invalid credentials',
    ]);
});

test('login fails for a non-existent email', function () {
    $response = $this->postJson('/api/auth/login', [
        'email' => 'nobody@example.com',
        'password' => 'password123',
    ]);

    $response->assertStatus(401)->assertJson(['status' => 'error']);
});

test('login response reflects the user stage based on signal count', function () {
    $user = User::factory()->create([
        'email' => 'ahmed@example.com',
        'password' => 'password123',
    ]);

    Favorite::create([
        'user_id' => $user->id,
        'title_name' => 'Better Call Saul',
        'title_type' => 'tv_show',
        'genres' => 'Crime,Drama',
        'release_year' => 2015,
        'added_at' => now(),
    ]);

    $response = $this->postJson('/api/auth/login', [
        'email' => 'ahmed@example.com',
        'password' => 'password123',
    ]);

    $response->assertStatus(200);
    expect($response->json('data.user.stage'))->toBe('explorer');
});

// === ME TESTS ===

test('an authenticated user can fetch their own data', function () {
    $user = User::factory()->create();
    $token = auth('api')->login($user);

    $response = $this->withToken($token)->getJson('/api/auth/me');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => [
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'stage' => 'stranger',
            ],
        ],
    ]);
});

test('an unauthenticated request to me is rejected', function () {
    $response = $this->getJson('/api/auth/me');

    $response->assertStatus(401);
});

// === LOGOUT TESTS ===

test('logout invalidates the current token', function () {
    $user = User::factory()->create();
    $token = auth('api')->login($user);

    $this->withToken($token)->postJson('/api/auth/logout')->assertStatus(200);

    $this->withToken($token)->getJson('/api/auth/me')->assertStatus(401);
});

// === REFRESH TESTS ===

test('an authenticated user can refresh their token', function () {
    $user = User::factory()->create();
    $token = auth('api')->login($user);

    $response = $this->withToken($token)->postJson('/api/auth/refresh');

    $response->assertStatus(200)->assertJsonStructure([
        'status',
        'data' => ['user' => ['id', 'email', 'stage'], 'token', 'token_type', 'expires_in'],
    ]);

    expect($response->json('data.token'))->not->toBe($token);
});
