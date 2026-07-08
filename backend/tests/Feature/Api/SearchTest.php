<?php

declare(strict_types=1);

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
use App\Services\MLClientService;

// === AUTOCOMPLETE TESTS ===

test('a guest can autocomplete search results', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('search')
            ->once()
            ->with('Br', 12)
            ->andReturn([
                ['title' => 'Breaking Bad', 'type' => 'TV Show', 'release_year' => 2008],
                ['title' => 'Breaking Surface', 'type' => 'Movie', 'release_year' => 2020],
            ]);
    });

    $response = $this->getJson('/api/search?q=Br&limit=12');

    $response->assertStatus(200)->assertJson([
        'status' => 'success',
        'data' => [
            ['title' => 'Breaking Bad', 'type' => 'TV Show', 'release_year' => 2008],
            ['title' => 'Breaking Surface', 'type' => 'Movie', 'release_year' => 2020],
        ],
    ]);
});

test('search with fewer than 2 characters fails validation', function () {
    $response = $this->getJson('/api/search?q=B');

    $response->assertStatus(422)->assertJson([
        'status' => 'error',
        'message' => 'Enter at least 2 characters',
    ]);
});

test('search without a query fails validation', function () {
    $response = $this->getJson('/api/search');

    $response->assertStatus(422)->assertJson([
        'status' => 'error',
        'message' => 'Enter at least 2 characters',
    ]);
});

test('search with a limit above 20 fails validation', function () {
    $response = $this->getJson('/api/search?q=Br&limit=21');

    $response->assertStatus(422);
});

test('search returns 503 when the ML service is unreachable', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('search')->once()->andThrow(new MlConnectionException);
    });

    $response = $this->getJson('/api/search?q=Br');

    $response->assertStatus(503)->assertJson([
        'status' => 'error',
        'message' => 'Service not available right now',
    ]);
});

test('search returns 504 when the ML service times out', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('search')->once()->andThrow(new MlTimeoutException);
    });

    $response = $this->getJson('/api/search?q=Br');

    $response->assertStatus(504)->assertJson([
        'status' => 'error',
        'message' => 'Service took too long',
    ]);
});
