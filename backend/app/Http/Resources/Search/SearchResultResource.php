<?php

declare(strict_types=1);

namespace App\Http\Resources\Search;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Override;

/**
 * Wraps one raw autocomplete item from MLClientService::search().
 */
class SearchResultResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    #[Override]
    public function toArray(Request $request): array
    {
        return [
            'title' => $this->resource['title'],
            'type' => $this->resource['type'],
            'release_year' => $this->resource['release_year'],
        ];
    }
}
