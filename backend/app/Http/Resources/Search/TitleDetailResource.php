<?php

declare(strict_types=1);

namespace App\Http\Resources\Search;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Wraps the raw title detail array from MLClientService::getTitleDetail().
 * ML returns genres as a comma-joined string; the documented API contract
 * (docs/features/feature-search-discovery/02_api_contracts/04_Endpoint_Title_Details.png)
 * exposes it as an array, so it's split here.
 */
class TitleDetailResource extends JsonResource
{
    /**
     * @param  array{title: string, type: string, genres: string, rating: string, country: string, release_year: int, director: string}  $resource
     * @param  array{is_favorite: bool, is_watched: bool}|null  $userSignals  omitted entirely for guests
     */
    public function __construct(array $resource, private readonly ?array $userSignals = null)
    {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $data = [
            'title' => $this->resource['title'],
            'type' => $this->resource['type'],
            'genres' => collect(explode(',', $this->resource['genres']))
                ->map(fn (string $genre) => trim($genre))
                ->filter()
                ->values()
                ->all(),
            'rating' => $this->resource['rating'],
            'country' => $this->resource['country'],
            'release_year' => $this->resource['release_year'],
            'director' => $this->resource['director'],
        ];

        if ($this->userSignals !== null) {
            $data['user_signals'] = $this->userSignals;
        }

        return $data;
    }
}
