<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\WatchedTitle;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Override;

/**
 * @property WatchedTitle $resource
 */
class WatchedTitleResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    #[Override]
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'title_name' => $this->resource->title_name,
            'title_type' => $this->resource->title_type->label(),
            'genres' => $this->resource->genres,
            'release_year' => $this->resource->release_year,
            'watched_at' => $this->resource->watched_at->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
