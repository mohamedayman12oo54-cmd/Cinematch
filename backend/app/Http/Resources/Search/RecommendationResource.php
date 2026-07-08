<?php

declare(strict_types=1);

namespace App\Http\Resources\Search;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Override;

/**
 * Wraps the raw MLClientService::getRecommendations() envelope, mapping each
 * result through RecommendationItemResource with its own per-title signals.
 */
class RecommendationResource extends JsonResource
{
    /**
     * @param  array{query: string, matched_title: string, total: int, results: array<int, array<string, mixed>>}  $resource
     * @param  array<string, array{is_favorite: bool, is_watched: bool}>|null  $signalsByTitle  null for guests
     */
    public function __construct(array $resource, private readonly ?array $signalsByTitle = null)
    {
        parent::__construct($resource);
    }

    /**
     * @return array<string, mixed>
     */
    #[Override]
    public function toArray(Request $request): array
    {
        return [
            'query' => $this->resource['query'],
            'matched_title' => $this->resource['matched_title'],
            'total' => $this->resource['total'],
            'results' => collect($this->resource['results'])
                ->map(fn (array $item) => (new RecommendationItemResource(
                    $item,
                    $this->signalsByTitle[$item['title']] ?? null,
                ))->resolve($request))
                ->all(),
        ];
    }
}
