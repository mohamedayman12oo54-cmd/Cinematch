<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\TitleType;
use App\Models\User;
use App\Models\WatchedTitle;
use Carbon\Carbon;
use Database\Seeders\Support\TitlePool;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

/**
 * Seeds Watched History for each testing persona.
 *
 * Mirrors FavoriteSeeder's approach: fixed, intentional title lists and
 * spread-out `watched_at` timestamps rather than random data. Some titles
 * deliberately overlap with a user's own Favorites (to test a title existing
 * in both tables) and with other users' data (to test cross-user
 * isolation) — see docs/testing/TEST_DATASET.md for the full rationale.
 */
class WatchedTitleSeeder extends Seeder
{
    public function run(): void
    {
        $titles = TitlePool::all();

        // user1@example.com (Fresh User) intentionally gets zero watched titles.

        $this->seedFor('user2@example.com', array_slice($titles, 1, 2), daysApart: 2);
        $this->seedFor('user3@example.com', array_slice($titles, 30, 6), daysApart: 3);
        $this->seedFor('user4@example.com', [...array_slice($titles, 33, 1), ...array_slice($titles, 36, 3)], daysApart: 3);
        $this->seedFor('user5@example.com', array_slice($titles, 39, 10), daysApart: 4);
        $this->seedFor('user6@example.com', array_slice($titles, 0, 30), daysApart: 12);
    }

    /**
     * @param  array<int, array{title_name: string, title_type: TitleType, genres: string, release_year: int}>  $titles
     */
    private function seedFor(string $email, array $titles, int $daysApart): void
    {
        /** @var User $user */
        $user = User::query()->where('email', $email)->firstOrFail();

        $now = Carbon::now();

        Collection::make($titles)->each(function (array $title, int $index) use ($user, $now, $daysApart): void {
            WatchedTitle::query()->updateOrCreate(
                [
                    'user_id' => $user->id,
                    'title_name' => $title['title_name'],
                ],
                [
                    'title_type' => $title['title_type'],
                    'genres' => $title['genres'],
                    'release_year' => $title['release_year'],
                    'watched_at' => $now->copy()->subDays($index * $daysApart),
                ],
            );
        });
    }
}
