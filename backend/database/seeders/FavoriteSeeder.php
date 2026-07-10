<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Enums\TitleType;
use App\Models\Favorite;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\Support\TitlePool;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;

/**
 * Seeds Favorites for each testing persona.
 *
 * Counts are intentional (not randomized) and line up with the Home
 * feature's signal-count stages documented in docs/testing/TEST_DATASET.md:
 * stranger (0), explorer (1-4), regular (5-19), loyal (20+). `added_at`
 * values are spread across time (newest first) so recency-ordered sections
 * (e.g. Loyal's "5 most recent favorites") can be exercised meaningfully.
 */
class FavoriteSeeder extends Seeder
{
    public function run(): void
    {
        $titles = TitlePool::all();

        // user1@example.com (Fresh User) intentionally gets zero favorites.

        $this->seedFor('user2@example.com', array_slice($titles, 0, 2), daysApart: 2);
        $this->seedFor('user3@example.com', array_slice($titles, 3, 6), daysApart: 3);
        $this->seedFor('user4@example.com', array_slice($titles, 7, 4), daysApart: 3);
        $this->seedFor('user5@example.com', array_slice($titles, 10, 12), daysApart: 3);
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
            Favorite::query()->updateOrCreate(
                [
                    'user_id' => $user->id,
                    'title_name' => $title['title_name'],
                ],
                [
                    'title_type' => $title['title_type'],
                    'genres' => $title['genres'],
                    'release_year' => $title['release_year'],
                    'added_at' => $now->copy()->subDays($index * $daysApart),
                ],
            );
        });
    }
}
