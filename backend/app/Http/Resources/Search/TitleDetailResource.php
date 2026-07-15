<?php

declare(strict_types=1);

namespace App\Http\Resources\Search;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Override;

/**
 * Wraps the raw title detail array from MLClientService::getTitleDetail(),
 * merged with TmdbMappingService::resolve()'s presentation enrichment.
 * ML returns genres as a comma-joined string; the documented API contract
 * (docs/features/feature-search-discovery/02_api_contracts/04_Endpoint_Title_Details.png)
 * exposes it as an array, so it's split here.
 */
class TitleDetailResource extends JsonResource
{
    /**
     * @param  array{title: string, type: string, genres: string, rating: string, country: string, release_year: int, director: string}  $resource
     * @param  array{is_favorite: bool, is_watched: bool}|null  $userSignals  omitted entirely for guests
     * @param  array{poster_url: ?string, backdrop_url: ?string, overview: ?string, vote_average: ?float, runtime: ?int, cast: array<int, string>, trailer_key: ?string, tmdb_available: bool}  $tmdb  see docs/archeticutre_enhancement/12_Title_Detail_Response_Changes.svg — always present, tmdb_available flags whether it's real data or the graceful-degradation fallback
     */
    public function __construct(
        array $resource,
        private readonly ?array $userSignals,
        private readonly array $tmdb,
    ) {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    #[Override]
    public function toArray(Request $request): array
    {
        $data = [
            'title' => $this->resource['title'],
            'type' => $this->resource['type'],
            'genres' => collect(explode(',', (string) $this->resource['genres']))
                ->map(fn (string $genre) => trim($genre))
                ->filter()
                ->values()
                ->all(),
            'rating' => $this->resource['rating'],
            'country' => $this->resource['country'],
            'release_year' => $this->resource['release_year'],
            'director' => $this->resource['director'],

            // TMDB enrichment — always present; tmdb_available tells the
            // frontend whether to render the rich UI or the fallback one.
            'poster_url' => $this->tmdb['poster_url'],
            'backdrop_url' => $this->tmdb['backdrop_url'],
            'overview' => $this->tmdb['overview'],
            'vote_average' => $this->tmdb['vote_average'],
            'runtime' => $this->tmdb['runtime'],
            'cast' => $this->tmdb['cast'],
            'trailer_key' => $this->tmdb['trailer_key'],
            'tmdb_available' => $this->tmdb['tmdb_available'],
        ];

        if ($this->userSignals !== null) {
            $data['user_signals'] = $this->userSignals;
        }

        return $data;
    }
}
