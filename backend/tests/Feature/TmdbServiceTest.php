<?php

declare(strict_types=1);

use App\Enums\TmdbMediaType;
use App\Services\TmdbService;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config(['services.tmdb.token' => 'test-token']);
    $this->tmdbService = app(TmdbService::class);
});

// ======= Helpers =======

/**
 * @return array<string, mixed>
 */
function tmdbSearchResult(int $id, string $dateField, ?string $date, ?string $posterPath = '/poster.jpg', ?string $backdropPath = '/backdrop.jpg'): array
{
    return [
        'id' => $id,
        $dateField => $date,
        'poster_path' => $posterPath,
        'backdrop_path' => $backdropPath,
    ];
}

// === MATCHING (findByTitle) ===

test('findByTitle returns the tmdb id and image paths for a matching movie', function () {
    Http::fake([
        'api.themoviedb.org/3/search/movie*' => Http::response([
            'results' => [tmdbSearchResult(550, 'release_date', '1999-10-15')],
        ]),
    ]);

    $match = $this->tmdbService->findByTitle('Fight Club', 1999, TmdbMediaType::Movie);

    expect($match)->toBe(['tmdb_id' => 550, 'poster_path' => '/poster.jpg', 'backdrop_path' => '/backdrop.jpg']);
});

test('findByTitle searches /search/tv for TV shows, keyed off first_air_date', function () {
    Http::fake([
        'api.themoviedb.org/3/search/tv*' => Http::response([
            'results' => [tmdbSearchResult(1396, 'first_air_date', '2008-01-20')],
        ]),
    ]);

    $match = $this->tmdbService->findByTitle('Breaking Bad', 2008, TmdbMediaType::Tv);

    expect($match['tmdb_id'])->toBe(1396);
    Http::assertSent(fn ($request): bool => str_contains((string) $request->url(), '/search/tv'));
});

test('findByTitle returns null when TMDB has no results at all', function () {
    Http::fake(['api.themoviedb.org/3/search/movie*' => Http::response(['results' => []])]);

    expect($this->tmdbService->findByTitle('Some Obscure Title', 1975, TmdbMediaType::Movie))->toBeNull();
});

test('findByTitle rejects a candidate whose year is outside the ±1 tolerance', function () {
    // "Wrong TMDB Match" edge case (docs/archeticutre_enhancement/10_Q8_EdgeCases.svg):
    // a same-named but unrelated result must not be returned as a match.
    Http::fake([
        'api.themoviedb.org/3/search/movie*' => Http::response([
            'results' => [tmdbSearchResult(999, 'release_date', '1994-01-01')],
        ]),
    ]);

    expect($this->tmdbService->findByTitle('Lion King', 2019, TmdbMediaType::Movie))->toBeNull();
});

test('findByTitle accepts a candidate exactly one year off (±1 tolerance)', function () {
    Http::fake([
        'api.themoviedb.org/3/search/movie*' => Http::response([
            'results' => [tmdbSearchResult(42, 'release_date', '2008-12-31')],
        ]),
    ]);

    expect($this->tmdbService->findByTitle('Some Title', 2009, TmdbMediaType::Movie)['tmdb_id'])->toBe(42);
});

test('findByTitle returns the top result when no release year is given to disambiguate with', function () {
    Http::fake([
        'api.themoviedb.org/3/search/movie*' => Http::response([
            'results' => [tmdbSearchResult(1, 'release_date', '2001-01-01'), tmdbSearchResult(2, 'release_date', '1950-01-01')],
        ]),
    ]);

    expect($this->tmdbService->findByTitle('Untitled', null, TmdbMediaType::Movie)['tmdb_id'])->toBe(1);
});

test('findByTitle returns null when TMDB_API_TOKEN is not configured', function () {
    config(['services.tmdb.token' => null]);
    Http::fake();

    expect($this->tmdbService->findByTitle('Anything', 2020, TmdbMediaType::Movie))->toBeNull();
    Http::assertNothingSent();
});

// === DETAILS (getDetails) ===

test('getDetails merges overview, vote_average, runtime, cast, and trailer_key from one request', function () {
    Http::fake([
        'api.themoviedb.org/3/movie/550*' => Http::response([
            'overview' => 'An insomniac office worker...',
            'vote_average' => 8.4,
            'runtime' => 139,
            'poster_path' => '/poster.jpg',
            'backdrop_path' => '/backdrop.jpg',
            'credits' => ['cast' => [
                ['name' => 'Edward Norton'], ['name' => 'Brad Pitt'], ['name' => 'Helena Bonham Carter'],
                ['name' => 'Meat Loaf'], ['name' => 'Jared Leto'], ['name' => 'Extra Sixth Actor'],
            ]],
            'videos' => ['results' => [
                ['site' => 'YouTube', 'type' => 'Teaser', 'key' => 'wrong-one'],
                ['site' => 'YouTube', 'type' => 'Trailer', 'key' => 'BdJKm16Co6M'],
            ]],
        ]),
    ]);

    $details = $this->tmdbService->getDetails(550, TmdbMediaType::Movie);

    expect($details)->toBe([
        'overview' => 'An insomniac office worker...',
        'vote_average' => 8.4,
        'runtime' => 139,
        'poster_path' => '/poster.jpg',
        'backdrop_path' => '/backdrop.jpg',
        'cast' => ['Edward Norton', 'Brad Pitt', 'Helena Bonham Carter', 'Meat Loaf', 'Jared Leto'],
        'trailer_key' => 'BdJKm16Co6M',
    ]);

    Http::assertSent(fn ($request): bool => str_contains((string) $request->url(), 'append_to_response=credits%2Cvideos')
        || str_contains((string) $request->url(), 'append_to_response=credits,videos'));
});

test('getDetails reads runtime from episode_run_time for TV shows', function () {
    Http::fake([
        'api.themoviedb.org/3/tv/1396*' => Http::response([
            'overview' => 'A chemistry teacher...',
            'vote_average' => 8.9,
            'episode_run_time' => [47],
            'poster_path' => null,
            'backdrop_path' => null,
            'credits' => ['cast' => []],
            'videos' => ['results' => []],
        ]),
    ]);

    $details = $this->tmdbService->getDetails(1396, TmdbMediaType::Tv);

    expect($details['runtime'])->toBe(47);
    expect($details['trailer_key'])->toBeNull();
    expect($details['cast'])->toBe([]);
});

test('getDetails returns null when TMDB responds with an error status', function () {
    Http::fake(['api.themoviedb.org/3/movie/999999*' => Http::response(['status_message' => 'Not found'], 404)]);

    expect($this->tmdbService->getDetails(999999, TmdbMediaType::Movie))->toBeNull();
});

test('getTrailerKey reuses getDetails rather than firing a second request', function () {
    Http::fake([
        'api.themoviedb.org/3/movie/550*' => Http::response([
            'overview' => null, 'vote_average' => null, 'runtime' => null,
            'poster_path' => null, 'backdrop_path' => null,
            'credits' => ['cast' => []],
            'videos' => ['results' => [['site' => 'YouTube', 'type' => 'Trailer', 'key' => 'abc123']]],
        ]),
    ]);

    expect($this->tmdbService->getTrailerKey(550, TmdbMediaType::Movie))->toBe('abc123');
    Http::assertSentCount(1);
});

// === IMAGES ===

test('posterUrl and backdropUrl build full URLs from configured base and size', function () {
    config(['services.tmdb.image_base_url' => 'https://image.tmdb.org/t/p', 'services.tmdb.poster_size' => 'w500', 'services.tmdb.backdrop_size' => 'original']);

    expect($this->tmdbService->posterUrl('/abc.jpg'))->toBe('https://image.tmdb.org/t/p/w500/abc.jpg');
    expect($this->tmdbService->backdropUrl('/xyz.jpg'))->toBe('https://image.tmdb.org/t/p/original/xyz.jpg');
});

test('posterUrl and backdropUrl return null for a null or empty path', function () {
    expect($this->tmdbService->posterUrl(null))->toBeNull();
    expect($this->tmdbService->backdropUrl(''))->toBeNull();
});

// === GRACEFUL DEGRADATION ===

test('a connection failure degrades to null instead of throwing', function () {
    Http::fake(function (): void {
        throw new ConnectionException('Could not connect to host.');
    });

    expect($this->tmdbService->findByTitle('Anything', 2020, TmdbMediaType::Movie))->toBeNull();
    expect($this->tmdbService->getDetails(1, TmdbMediaType::Movie))->toBeNull();
});

test('a malformed/empty results array is handled without error', function () {
    Http::fake(['api.themoviedb.org/3/search/movie*' => Http::response(['results' => null])]);

    expect($this->tmdbService->findByTitle('Anything', 2020, TmdbMediaType::Movie))->toBeNull();
});

// === BATCH SEARCH (findManyByTitle) ===

test('findManyByTitle fires one parallel request per entry and matches each back to its key', function () {
    Http::fake([
        'api.themoviedb.org/3/search/movie*' => Http::sequence()
            ->push(['results' => [tmdbSearchResult(1, 'release_date', '2010-01-01')]])
            ->push(['results' => [tmdbSearchResult(2, 'release_date', '2015-01-01')]]),
    ]);

    $results = $this->tmdbService->findManyByTitle([
        'Inception' => ['title' => 'Inception', 'release_year' => 2010, 'type' => TmdbMediaType::Movie],
        'Whiplash' => ['title' => 'Whiplash', 'release_year' => 2015, 'type' => TmdbMediaType::Movie],
    ]);

    expect($results['Inception']['tmdb_id'])->toBe(1);
    expect($results['Whiplash']['tmdb_id'])->toBe(2);
});

test('findManyByTitle returns an empty array for an empty input without making any request', function () {
    Http::fake();

    expect($this->tmdbService->findManyByTitle([]))->toBe([]);
    Http::assertNothingSent();
});

test('findManyByTitle degrades every entry to null if the whole pool fails', function () {
    Http::fake(function (): void {
        throw new ConnectionException('Pool unreachable.');
    });

    $results = $this->tmdbService->findManyByTitle([
        'A' => ['title' => 'A', 'release_year' => 2020, 'type' => TmdbMediaType::Movie],
        'B' => ['title' => 'B', 'release_year' => 2021, 'type' => TmdbMediaType::Tv],
    ]);

    expect($results)->toBe(['A' => null, 'B' => null]);
});
