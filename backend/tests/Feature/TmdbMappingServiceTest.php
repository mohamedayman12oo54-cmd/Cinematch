<?php

declare(strict_types=1);

use App\Enums\TmdbMediaType;
use App\Models\TitleTmdbMapping;
use App\Services\TmdbMappingService;
use App\Services\TmdbService;
use Illuminate\Support\Facades\Cache;

beforeEach(function () {
    Cache::flush();
    $this->tmdbService = Mockery::mock(TmdbService::class);
    $this->service = new TmdbMappingService($this->tmdbService);
});

// ======= Helpers =======

/**
 * @return array{overview: string, vote_average: float, runtime: int, poster_path: string, backdrop_path: string, cast: array<int, string>, trailer_key: string}
 */
function tmdbDetails(string $overview = 'An overview.'): array
{
    return [
        'overview' => $overview,
        'vote_average' => 8.5,
        'runtime' => 120,
        'poster_path' => '/poster.jpg',
        'backdrop_path' => '/backdrop.jpg',
        'cast' => ['Actor One', 'Actor Two'],
        'trailer_key' => 'abc123',
    ];
}

// === resolve(): CACHE ===

test('resolve returns the cached result without calling TmdbService at all', function () {
    Cache::put('tmdb:details:the matrix:1999', [
        'poster_url' => 'cached-poster', 'backdrop_url' => 'cached-backdrop', 'overview' => 'cached',
        'vote_average' => 1.0, 'runtime' => 1, 'cast' => [], 'trailer_key' => null, 'tmdb_available' => true,
    ], now()->addHour());

    $result = $this->service->resolve('The Matrix', 1999, TmdbMediaType::Movie);

    expect($result['overview'])->toBe('cached');
});

// === resolve(): DB MAPPING ALREADY EXISTS ===

test('resolve skips the search step when a DB mapping already exists, but still fetches details', function () {
    TitleTmdbMapping::factory()->create([
        'title_name' => 'The Matrix',
        'release_year' => 1999,
        'tmdb_id' => 603,
        'tmdb_type' => TmdbMediaType::Movie,
        'poster_path' => '/matrix.jpg',
        'backdrop_path' => '/matrix-bg.jpg',
    ]);

    $this->tmdbService->shouldReceive('getDetails')->once()->with(603, TmdbMediaType::Movie)->andReturn(tmdbDetails());
    $this->tmdbService->shouldReceive('posterUrl')->once()->with('/poster.jpg')->andReturn('https://img/poster.jpg');
    $this->tmdbService->shouldReceive('backdropUrl')->once()->with('/backdrop.jpg')->andReturn('https://img/backdrop.jpg');

    $result = $this->service->resolve('The Matrix', 1999, TmdbMediaType::Movie);

    expect($result)->toBe([
        'poster_url' => 'https://img/poster.jpg',
        'backdrop_url' => 'https://img/backdrop.jpg',
        'overview' => 'An overview.',
        'vote_average' => 8.5,
        'runtime' => 120,
        'cast' => ['Actor One', 'Actor Two'],
        'trailer_key' => 'abc123',
        'tmdb_available' => true,
    ]);
});

// === resolve(): FULL MISS ===

test('resolve searches, persists a new mapping, and caches the result on a total miss', function () {
    $this->tmdbService->shouldReceive('findByTitle')
        ->once()
        ->with('Whiplash', 2014, TmdbMediaType::Movie)
        ->andReturn(['tmdb_id' => 244786, 'poster_path' => '/whiplash.jpg', 'backdrop_path' => '/whiplash-bg.jpg']);
    $this->tmdbService->shouldReceive('getDetails')->once()->with(244786, TmdbMediaType::Movie)->andReturn(tmdbDetails('Drumming intensifies.'));
    $this->tmdbService->shouldReceive('posterUrl')->andReturn('https://img/whiplash.jpg');
    $this->tmdbService->shouldReceive('backdropUrl')->andReturn('https://img/whiplash-bg.jpg');

    $result = $this->service->resolve('Whiplash', 2014, TmdbMediaType::Movie);

    expect($result['overview'])->toBe('Drumming intensifies.');
    expect($result['tmdb_available'])->toBeTrue();

    $this->assertDatabaseHas('title_tmdb_mappings', [
        'title_name' => 'Whiplash',
        'release_year' => 2014,
        'tmdb_id' => 244786,
        'tmdb_type' => 'movie',
    ]);

    // Second call must be a pure cache hit — no further TmdbService calls
    // (Mockery's ->once() above would fail this test if called again).
    $second = $this->service->resolve('Whiplash', 2014, TmdbMediaType::Movie);
    expect($second['overview'])->toBe('Drumming intensifies.');
});

// === resolve(): GRACEFUL DEGRADATION ===

test('resolve returns the unavailable shape and negative-caches when TMDB has no match', function () {
    $this->tmdbService->shouldReceive('findByTitle')->once()->andReturn(null);

    $result = $this->service->resolve('Some Obscure Title', 1975, TmdbMediaType::Movie);

    expect($result)->toBe([
        'poster_url' => null, 'backdrop_url' => null, 'overview' => null,
        'vote_average' => null, 'runtime' => null, 'cast' => [], 'trailer_key' => null,
        'tmdb_available' => false,
    ]);

    $this->assertDatabaseMissing('title_tmdb_mappings', ['title_name' => 'Some Obscure Title']);

    // Cached (briefly) — a second call within the negative-cache window must
    // not search again (Mockery's ->once() above enforces this).
    $second = $this->service->resolve('Some Obscure Title', 1975, TmdbMediaType::Movie);
    expect($second['tmdb_available'])->toBeFalse();
});

test('resolve still persists the mapping even if the details call fails after a successful match', function () {
    // A transient TMDB failure right after a good match shouldn't waste the
    // match itself — the next request can skip straight to a details retry.
    $this->tmdbService->shouldReceive('findByTitle')->once()->andReturn(['tmdb_id' => 77, 'poster_path' => null, 'backdrop_path' => null]);
    $this->tmdbService->shouldReceive('getDetails')->once()->andReturn(null);

    $result = $this->service->resolve('Flaky Title', 2020, TmdbMediaType::Movie);

    expect($result['tmdb_available'])->toBeFalse();
    $this->assertDatabaseHas('title_tmdb_mappings', ['title_name' => 'Flaky Title', 'tmdb_id' => 77]);
});

// === resolve(): DUPLICATE TITLES / REMAKES ===

test('resolve treats the same title with different release years as distinct records', function () {
    TitleTmdbMapping::factory()->create([
        'title_name' => 'Lion King', 'release_year' => 1994, 'tmdb_id' => 8587, 'tmdb_type' => TmdbMediaType::Movie,
        'poster_path' => '/1994.jpg', 'backdrop_path' => null,
    ]);
    TitleTmdbMapping::factory()->create([
        'title_name' => 'Lion King', 'release_year' => 2019, 'tmdb_id' => 420818, 'tmdb_type' => TmdbMediaType::Movie,
        'poster_path' => '/2019.jpg', 'backdrop_path' => null,
    ]);

    $this->tmdbService->shouldReceive('getDetails')->once()->with(8587, TmdbMediaType::Movie)->andReturn(tmdbDetails('The original.'));
    $this->tmdbService->shouldReceive('getDetails')->once()->with(420818, TmdbMediaType::Movie)->andReturn(tmdbDetails('The remake.'));
    $this->tmdbService->shouldReceive('posterUrl')->andReturn('url');
    $this->tmdbService->shouldReceive('backdropUrl')->andReturn(null);

    expect($this->service->resolve('Lion King', 1994, TmdbMediaType::Movie)['overview'])->toBe('The original.');
    expect($this->service->resolve('Lion King', 2019, TmdbMediaType::Movie)['overview'])->toBe('The remake.');
});

// === getPostersForTitles(): CACHE / DB / BATCH ===

test('getPostersForTitles returns a cached poster without touching DB or TMDB', function () {
    Cache::put('tmdb:poster:inception:2010', 'https://img/inception.jpg', now()->addHour());

    $result = $this->service->getPostersForTitles([
        ['title' => 'Inception', 'release_year' => 2010, 'type' => TmdbMediaType::Movie],
    ]);

    expect($result)->toBe(['Inception' => 'https://img/inception.jpg']);
});

test('getPostersForTitles resolves from an existing DB mapping without any TMDB call', function () {
    TitleTmdbMapping::factory()->create([
        'title_name' => 'Whiplash', 'release_year' => 2014, 'tmdb_id' => 244786,
        'tmdb_type' => TmdbMediaType::Movie, 'poster_path' => '/w.jpg', 'backdrop_path' => null,
    ]);
    $this->tmdbService->shouldReceive('posterUrl')->once()->with('/w.jpg')->andReturn('https://img/w.jpg');

    $result = $this->service->getPostersForTitles([
        ['title' => 'Whiplash', 'release_year' => 2014, 'type' => TmdbMediaType::Movie],
    ]);

    expect($result)->toBe(['Whiplash' => 'https://img/w.jpg']);
});

test('getPostersForTitles searches and persists a new mapping on a total miss', function () {
    $this->tmdbService->shouldReceive('findManyByTitle')
        ->once()
        ->with(['New Title' => ['title' => 'New Title', 'release_year' => 2022, 'type' => TmdbMediaType::Movie]])
        ->andReturn(['New Title' => ['tmdb_id' => 5, 'poster_path' => '/n.jpg', 'backdrop_path' => null]]);
    $this->tmdbService->shouldReceive('posterUrl')->once()->with('/n.jpg')->andReturn('https://img/n.jpg');

    $result = $this->service->getPostersForTitles([
        ['title' => 'New Title', 'release_year' => 2022, 'type' => TmdbMediaType::Movie],
    ]);

    expect($result)->toBe(['New Title' => 'https://img/n.jpg']);
    $this->assertDatabaseHas('title_tmdb_mappings', ['title_name' => 'New Title', 'tmdb_id' => 5]);
});

test('getPostersForTitles only searches the subset that is neither cached nor in the DB', function () {
    Cache::put('tmdb:poster:cached title:2001', 'https://img/cached.jpg', now()->addHour());
    TitleTmdbMapping::factory()->create([
        'title_name' => 'Db Title', 'release_year' => 2002, 'tmdb_id' => 1,
        'tmdb_type' => TmdbMediaType::Movie, 'poster_path' => '/db.jpg', 'backdrop_path' => null,
    ]);

    $this->tmdbService->shouldReceive('posterUrl')->with('/db.jpg')->andReturn('https://img/db.jpg');
    $this->tmdbService->shouldReceive('findManyByTitle')
        ->once()
        ->with(['Miss Title' => ['title' => 'Miss Title', 'release_year' => 2003, 'type' => TmdbMediaType::Movie]])
        ->andReturn(['Miss Title' => ['tmdb_id' => 3, 'poster_path' => '/miss.jpg', 'backdrop_path' => null]]);
    $this->tmdbService->shouldReceive('posterUrl')->with('/miss.jpg')->andReturn('https://img/miss.jpg');

    $result = $this->service->getPostersForTitles([
        ['title' => 'Cached Title', 'release_year' => 2001, 'type' => TmdbMediaType::Movie],
        ['title' => 'Db Title', 'release_year' => 2002, 'type' => TmdbMediaType::Movie],
        ['title' => 'Miss Title', 'release_year' => 2003, 'type' => TmdbMediaType::Movie],
    ]);

    expect($result)->toBe([
        'Cached Title' => 'https://img/cached.jpg',
        'Db Title' => 'https://img/db.jpg',
        'Miss Title' => 'https://img/miss.jpg',
    ]);
});

test('getPostersForTitles matches distinct titles in the same batch to their own TMDB record', function () {
    $this->tmdbService->shouldReceive('findManyByTitle')
        ->once()
        ->with([
            'Inception' => ['title' => 'Inception', 'release_year' => 2010, 'type' => TmdbMediaType::Movie],
            'Whiplash' => ['title' => 'Whiplash', 'release_year' => 2014, 'type' => TmdbMediaType::Movie],
        ])
        ->andReturn([
            'Inception' => ['tmdb_id' => 27205, 'poster_path' => '/inception.jpg', 'backdrop_path' => null],
            'Whiplash' => ['tmdb_id' => 244786, 'poster_path' => '/whiplash.jpg', 'backdrop_path' => null],
        ]);
    $this->tmdbService->shouldReceive('posterUrl')->with('/inception.jpg')->andReturn('https://img/inception.jpg');
    $this->tmdbService->shouldReceive('posterUrl')->with('/whiplash.jpg')->andReturn('https://img/whiplash.jpg');

    $result = $this->service->getPostersForTitles([
        ['title' => 'Inception', 'release_year' => 2010, 'type' => TmdbMediaType::Movie],
        ['title' => 'Whiplash', 'release_year' => 2014, 'type' => TmdbMediaType::Movie],
    ]);

    expect($result)->toBe([
        'Inception' => 'https://img/inception.jpg',
        'Whiplash' => 'https://img/whiplash.jpg',
    ]);
});

test('getPostersForTitles collapses two entries sharing the same title in one batch onto one key (documented limitation)', function () {
    // Known limitation (see the docblock on getPostersForTitles): the batch
    // is keyed by title alone, so "Lion King" 1994 and 2019 in the *same*
    // call collide — the second entry silently wins. Neither current
    // caller (recommendations/home) can hit this in practice since ML
    // result sets don't repeat a title within one response, but it's
    // asserted here so a future change to that assumption doesn't silently
    // start dropping data unnoticed.
    $this->tmdbService->shouldReceive('findManyByTitle')
        ->once()
        ->with(['Lion King' => ['title' => 'Lion King', 'release_year' => 2019, 'type' => TmdbMediaType::Movie]])
        ->andReturn(['Lion King' => ['tmdb_id' => 420818, 'poster_path' => '/2019.jpg', 'backdrop_path' => null]]);
    $this->tmdbService->shouldReceive('posterUrl')->with('/2019.jpg')->andReturn('https://img/2019.jpg');

    $result = $this->service->getPostersForTitles([
        ['title' => 'Lion King', 'release_year' => 1994, 'type' => TmdbMediaType::Movie],
        ['title' => 'Lion King', 'release_year' => 2019, 'type' => TmdbMediaType::Movie],
    ]);

    expect($result)->toBe(['Lion King' => 'https://img/2019.jpg']);
});

test('getPostersForTitles returns an empty array for an empty input', function () {
    expect($this->service->getPostersForTitles([]))->toBe([]);
});
