<?php

declare(strict_types=1);

namespace App\Http\Resources\Search;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Wraps one raw recommendation item from MLClientService::getRecommendations().
 * Only the fields shown in docs/features/feature-search-discovery/
 * 02_api_contracts/05_Endpoint_Recommendations.png are exposed — genres/
 * rating/country/director/rank from the ML payload are dropped here.
 */
class RecommendationItemResource extends JsonResource
{
    /**
     * @param  array<string, mixed>  $resource
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
            'release_year' => $this->resource['release_year'],
            'similarity_score' => $this->resource['similarity'],
        ];

        if ($this->userSignals !== null) {
            $data['user_signals'] = $this->userSignals;
        }

        return $data;
    }
}
