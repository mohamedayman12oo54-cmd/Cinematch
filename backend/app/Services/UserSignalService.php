<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;

/**
 * Resolves is_favorite/is_watched flags for titles returned by the ML layer
 * (docs/features/feature-search-discovery/08_User_Signals_Enrichment.png).
 * These titles live only in the ML dataset, never as local models, so lookups
 * are always by title_name against the user's own favorites/watched_titles.
 */
class UserSignalService
{
    /**
     * @return array{is_favorite: bool, is_watched: bool}
     */
    public function signalsFor(User $user, string $titleName): array
    {
        return [
            'is_favorite' => $user->favorites()->where('title_name', $titleName)->exists(),
            'is_watched' => $user->watchedTitles()->where('title_name', $titleName)->exists(),
        ];
    }

    /**
     * @param  array<int, string>  $titleNames
     * @return array<string, array{is_favorite: bool, is_watched: bool}> keyed by title_name
     */
    public function signalsForMany(User $user, array $titleNames): array
    {
        $favorited = $user->favorites()->whereIn('title_name', $titleNames)->pluck('title_name')->all();
        $watched = $user->watchedTitles()->whereIn('title_name', $titleNames)->pluck('title_name')->all();

        $signals = [];
        foreach ($titleNames as $titleName) {
            $signals[$titleName] = [
                'is_favorite' => in_array($titleName, $favorited, true),
                'is_watched' => in_array($titleName, $watched, true),
            ];
        }

        return $signals;
    }
}
