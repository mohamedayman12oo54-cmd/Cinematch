<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\Favorite;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Override;

/**
 * @property Favorite $resource
 */
class FavoriteResource extends JsonResource
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
            'added_at' => $this->resource->added_at->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
