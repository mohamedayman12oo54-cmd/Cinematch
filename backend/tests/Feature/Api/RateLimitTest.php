<?php

declare(strict_types=1);

use App\Models\User;
use App\Services\MLClientService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\RateLimiter;

// Rate limiter state lives in the cache store, which persists across tests
// within the same process (CACHE_STORE=array in phpunit.xml) — every test
// here needs a clean bucket regardless of what earlier tests in the suite
// already sent to these same routes.
beforeEach(fn () => Cache::flush());

// === LOGIN THROTTLE TESTS ===

test('login is rate limited to 5 attempts per minute', function () {
    for ($i = 0; $i < 5; $i++) {
        $this->postJson('/api/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong'])
            ->assertStatus(401);
    }

    $response = $this->postJson('/api/auth/login', ['email' => 'nobody@example.com', 'password' => 'wrong']);

    $response->assertStatus(429)->assertJson(['status' => 'error']);
    $response->assertHeader('Retry-After');
});

// === REGISTER THROTTLE TESTS ===

test('register is rate limited to 10 attempts per minute', function () {
    for ($i = 0; $i < 10; $i++) {
        $this->postJson('/api/auth/register', [
            'email' => "user{$i}@example.com",
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertStatus(201);
    }

    $response = $this->postJson('/api/auth/register', [
        'email' => 'one-too-many@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ]);

    $response->assertStatus(429)->assertJson(['status' => 'error']);
});

// === PUBLIC ROUTE THROTTLE TESTS ===

test('public routes are rate limited to 60 requests per minute', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->andReturn([]);
    });

    for ($i = 0; $i < 60; $i++) {
        $this->getJson('/api/home')->assertStatus(200);
    }

    $response = $this->getJson('/api/home');

    $response->assertStatus(429)->assertJson(['status' => 'error']);
});

// === PROTECTED ROUTE THROTTLE TESTS ===

test('protected routes are rate limited to 100 requests per minute per user', function () {
    $user = User::factory()->create();
    $token = auth('api')->login($user);

    for ($i = 0; $i < 100; $i++) {
        $this->withToken($token)->getJson('/api/auth/me')->assertStatus(200);
    }

    $response = $this->withToken($token)->getJson('/api/auth/me');

    $response->assertStatus(429)->assertJson(['status' => 'error']);
});

test('the protected rate limiter keys by authenticated user id, not shared ip', function () {
    // Exercised directly against the registered limiter closure rather than
    // through two real simulated requests: the JWT guard instance is a
    // container singleton that persists across every getJson() call within
    // one test method and caches its resolved user after the first
    // authentication, so a second withToken() call in the same test can't
    // reliably prove a *different* user was resolved — a test-tooling
    // quirk, not a production concern (a real request always gets a fresh
    // guard). Calling the limiter closure with two independently-stubbed
    // requests avoids that quirk entirely and asserts the actual behavior
    // this test cares about: the bucket key comes from the user, not the IP.
    $userA = User::factory()->create();
    $userB = User::factory()->create();

    $limiter = RateLimiter::limiter('protected');

    $requestA = Request::create('/api/auth/me');
    $requestA->setUserResolver(fn () => $userA);

    $requestB = Request::create('/api/auth/me');
    $requestB->setUserResolver(fn () => $userB);

    expect($limiter($requestA)->key)->not->toBe($limiter($requestB)->key);
});
