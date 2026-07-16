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
     * poster_url is the only TMDB field a watch-history card needs — same
     * reasoning as FavoriteResource (docs/enhancement/tmdb_response_enrichment.md):
     * genres/type/release_year are already snapshotted from ML at
     * watched-at time (WatchedTitleService::addWatched()), and a rating
     * adds little value for a list of titles the user already watched.
     *
     * @param  ?string  $posterUrl  null if TMDB has no match / is unavailable — frontend shows a placeholder
     */
    public function __construct(WatchedTitle $resource, private readonly ?string $posterUrl)
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
            'watched_at' => $this->resource->watched_at->utc()->format('Y-m-d\TH:i:s\Z'),
        ];
    }
}
