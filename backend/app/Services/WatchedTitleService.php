<?php

declare(strict_types=1);

namespace App\Services;

use App\Enums\TitleType;
use App\Models\User;
use App\Models\WatchedTitle;
use Illuminate\Database\Eloquent\Collection;

class WatchedTitleService
{
    public function __construct(private readonly MLClientService $mlClientService) {}

    // ======= List Watch History =======

    /**
     * @return Collection<int, WatchedTitle>
     */
    public function getHistory(User $user): Collection
    {
        return $user->watchedTitles()->orderByDesc('watched_at')->get();
    }

    // ======= Mark As Watched =======

    /**
     * Genres/type/release_year are snapshotted from the ML layer at the
     * moment of marking watched (docs/features/03_feature-watched-titles/
     * 01_feature_analysis/02_Business_Rules.svg, Rule 3) — never re-fetched
     * from ML on read.
     *
     * @return array{success: bool, reason?: 'not_found'|'duplicate', watchedTitle?: WatchedTitle}
     */
    public function addWatched(User $user, string $titleName): array
    {
        $detail = $this->mlClientService->getTitleDetail($titleName);

        if ($detail === null) {
            return ['success' => false, 'reason' => 'not_found'];
        }

        if ($user->watchedTitles()->where('title_name', $detail['title'])->exists()) {
            return ['success' => false, 'reason' => 'duplicate'];
        }

        $watchedTitle = $user->watchedTitles()->create([
            'title_name' => $detail['title'],
            'title_type' => TitleType::fromLabel($detail['type']),
            'genres' => $detail['genres'],
            'release_year' => $detail['release_year'],
            'watched_at' => now(),
        ]);

        return ['success' => true, 'watchedTitle' => $watchedTitle];
    }

    // ======= Remove From History =======

    public function removeWatched(User $user, string $titleName): bool
    {
        return $user->watchedTitles()->where('title_name', $titleName)->delete() > 0;
    }
}
