<?php

declare(strict_types=1);

namespace App\Http\Controllers\Concerns;

use App\Enums\TmdbMediaType;
use App\Models\Favorite;
use App\Models\WatchedTitle;
use App\Services\TmdbMappingService;
use Illuminate\Support\Collection;

/**
 * Shared by FavoriteController and WatchedTitleController — both list a
 * Collection of owned-title rows (title_name, release_year, title_type
 * already snapshotted from ML at add-time) and only need a poster_url per
 * item, batched in one TmdbMappingService::getCardMetadataForTitles() call
 * rather than N+1 lookups.
 *
 * Unlike TitleController (Recommendations/Home), title_type here is
 * already a validated TitleType enum on the model — TmdbMediaType::fromTitleType()
 * is used directly instead of the fallible tryFromLabel(), since there's
 * no raw ML label to parse.
 */
trait ResolvesPosterUrls
{
    /**
     * @param  Collection<int, Favorite|WatchedTitle>  $items
     * @return array<string, ?string> poster_url keyed by title_name
     */
    private function posterUrlByTitle(TmdbMappingService $tmdbMappingService, Collection $items): array
    {
        if ($items->isEmpty()) {
            return [];
        }

        $entries = $items
            ->map(fn (Favorite|WatchedTitle $item): array => [
                'title' => $item->title_name,
                'release_year' => $item->release_year,
                'type' => TmdbMediaType::fromTitleType($item->title_type),
            ])
            ->all();

        return collect($tmdbMappingService->getCardMetadataForTitles($entries))
            ->map(fn (array $metadata): ?string => $metadata['poster_url'])
            ->all();
    }
}
