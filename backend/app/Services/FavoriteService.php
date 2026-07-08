<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\TitleType;
use App\Models\Favorite;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

class FavoriteService
{
    public function __construct(private readonly MLClientService $mlClientService) {}

    // ======= List Favorites =======

    /**
     * @return Collection<int, Favorite>
     */
    public function getFavorites(User $user): Collection
    {
        return $user->favorites()->orderByDesc('added_at')->get();
    }

    // ======= Add Favorite =======

    /**
     * Genres/type/release_year are snapshotted from the ML layer at the
     * moment of adding (docs/features/02_feature-favorites/03_Genres_Snapshot.svg)
     * — never re-fetched from ML on read.
     *
     * @return array{success: bool, reason?: 'not_found'|'duplicate', favorite?: Favorite}
     */
    public function addFavorite(User $user, string $titleName): array
    {
        $detail = $this->mlClientService->getTitleDetail($titleName);

        if ($detail === null) {
            return ['success' => false, 'reason' => 'not_found'];
        }

        if ($user->favorites()->where('title_name', $detail['title'])->exists()) {
            return ['success' => false, 'reason' => 'duplicate'];
        }

        $favorite = $user->favorites()->create([
            'title_name' => $detail['title'],
            'title_type' => TitleType::fromLabel($detail['type']),
            'genres' => $detail['genres'],
            'release_year' => $detail['release_year'],
            'added_at' => now(),
        ]);

        return ['success' => true, 'favorite' => $favorite];
    }

    // ======= Remove Favorite =======

    public function removeFavorite(User $user, string $titleName): bool
    {
        return $user->favorites()->where('title_name', $titleName)->delete() > 0;
    }
}
