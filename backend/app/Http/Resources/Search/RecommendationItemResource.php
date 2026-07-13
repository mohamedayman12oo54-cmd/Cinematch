<?php

declare(strict_types=1);

namespace App\Http\Resources\Search;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Override;

/**
 * Wraps one raw recommendation item from MLClientService::getRecommendations().
 * Only the fields shown in docs/features/feature-search-discovery/
 * 02_api_contracts/05_Endpoint_Recommendations.png are exposed — genres/
 * rating/country/director/rank from the ML payload are dropped here.
 *
 * poster_url is the one piece of TMDB enrichment recommendations get (see
 * docs/archeticutre_enhancement/13_Recommendation_Item_Changes.svg) — full
 * detail (overview, cast, trailer...) is reserved for the Title Details
 * page only, since fetching it for every card in a list would be wasteful.
 */
class RecommendationItemResource extends JsonResource
{
    /**
     * @param  array<string, mixed>  $resource
     * @param  array{is_favorite: bool, is_watched: bool}|null  $userSignals  omitted entirely for guests
     * @param  ?string  $posterUrl  null if TMDB has no match / is unavailable — frontend shows a placeholder
     */
    public function __construct(
        array $resource,
        private readonly ?array $userSignals,
        private readonly ?string $posterUrl,
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
            'release_year' => $this->resource['release_year'],
            'similarity_score' => $this->resource['similarity'],
            'poster_url' => $this->posterUrl,
        ];

        if ($this->userSignals !== null) {
            $data['user_signals'] = $this->userSignals;
        }

        return $data;
    }
}
