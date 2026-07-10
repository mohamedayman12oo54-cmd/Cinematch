<?php

declare(strict_types=1);

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
use App\Services\MLClientService;

// === 404 TESTS ===

test('an unmatched api route returns a consistent 404 json envelope', function () {
    $response = $this->getJson('/api/this-route-does-not-exist');

    $response->assertStatus(404)->assertExactJson([
        'status' => 'error',
        'message' => 'Endpoint not found',
    ]);
});

// === 401 TESTS ===

test('an unauthenticated request to a protected route returns a consistent 401 json envelope', function () {
    $response = $this->getJson('/api/favorites');

    $response->assertStatus(401)->assertExactJson([
        'status' => 'error',
        'message' => 'Unauthenticated',
    ]);
});

// === 422 VALIDATION TESTS ===

test('a validation failure returns the consistent envelope with a nested errors object', function () {
    $response = $this->postJson('/api/auth/register', ['email' => 'not-an-email']);

    $response->assertStatus(422)->assertJson([
        'status' => 'error',
        'message' => 'The given data was invalid.',
    ]);

    expect($response->json('errors'))->toHaveKey('email');
});

// === 500 CATCH-ALL TESTS ===

test('an unexpected exception outside production exposes the real message for debugging', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andThrow(new RuntimeException('some internal detail'));
    });

    $response = $this->getJson('/api/titles/Breaking Bad');

    $response->assertStatus(500)->assertExactJson([
        'status' => 'error',
        'message' => 'some internal detail',
    ]);
});

test('an unexpected exception in production returns a generic message without leaking details', function () {
    app()->instance('env', 'production');

    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andThrow(new RuntimeException('some internal detail'));
    });

    $response = $this->getJson('/api/titles/Breaking Bad');

    $response->assertStatus(500)->assertExactJson([
        'status' => 'error',
        'message' => 'Something went wrong',
    ]);

    expect($response->getContent())->not->toContain('some internal detail');
});

// === ML EXCEPTION TESTS (now handled centrally, not per-controller) ===

test('an unreachable ML service returns a consistent 503 json envelope', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andThrow(new MlConnectionException);
    });

    $response = $this->getJson('/api/titles/Breaking Bad');

    $response->assertStatus(503)->assertExactJson([
        'status' => 'error',
        'message' => 'Service not available right now',
    ]);
});

test('a timed-out ML service returns a consistent 504 json envelope', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getTitleDetail')->once()->andThrow(new MlTimeoutException);
    });

    $response = $this->getJson('/api/titles/Breaking Bad');

    $response->assertStatus(504)->assertExactJson([
        'status' => 'error',
        'message' => 'Service took too long',
    ]);
});
