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
     * poster_url is the only TMDB field a saved-favorites card needs (see
     * docs/enhancement/tmdb_response_enrichment.md) — genres/type/release_year
     * are already snapshotted from ML at add-time (FavoriteService::addFavorite()),
     * and a rating adds little value for a list of titles the user already
     * chose, unlike a discovery surface like Recommendations/Home.
     *
     * @param  ?string  $posterUrl  null if TMDB has no match / is unavailable — frontend shows a placeholder
     */
    public function __construct(Favorite $resource, private readonly ?string $posterUrl)
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
            'id' => $this->resource->id,
            'title_name' => $this->resource->title_name,
            'title_type' => $this->resource->title_type->label(),
            'genres' => $this->resource->genres,
            'release_year' => $this->resource->release_year,
            'poster_url' => $this->posterUrl,
            'added_at' => $this->resource->added_at->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
