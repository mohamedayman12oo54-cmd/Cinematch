<?php

declare(strict_types=1);

use App\Services\MLClientService;

test('a request from the trusted frontend origin receives the allow-origin header', function () {
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withHeaders(['Origin' => 'http://localhost:5173'])->getJson('/api/home');

    $response->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
});

test('the allow-origin header never reflects an untrusted requesting origin', function () {
    // With exactly one configured origin, the CORS library always emits
    // that fixed value rather than dynamically echoing the request's
    // Origin header — real protection comes from the browser rejecting a
    // response whose Access-Control-Allow-Origin doesn't match its own
    // origin, so what matters here is that the server never reflects an
    // arbitrary/untrusted Origin back (which would indicate a wildcard or
    // origin-reflection misconfiguration).
    $this->mock(MLClientService::class, function ($mock) {
        $mock->shouldReceive('getManyTitleDetails')->once()->andReturn([]);
    });

    $response = $this->withHeaders(['Origin' => 'http://evil.example.com'])->getJson('/api/home');

    expect($response->headers->get('Access-Control-Allow-Origin'))
        ->not->toBe('http://evil.example.com')
        ->toBe('http://localhost:5173');
});

test('a preflight request from the trusted origin is allowed', function () {
    $response = $this->withHeaders([
        'Origin' => 'http://localhost:5173',
        'Access-Control-Request-Method' => 'GET',
    ])->options('/api/home');

    $response->assertStatus(204)->assertHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
});
