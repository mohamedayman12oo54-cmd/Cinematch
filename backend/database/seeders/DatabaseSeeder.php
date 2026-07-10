<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database with the API/Postman testing dataset.
     *
     * See docs/testing/TEST_DATASET.md for the full persona breakdown.
     */
    public function run(): void
    {
        $this->call([
            UserSeeder::class,
            FavoriteSeeder::class,
            WatchedTitleSeeder::class,
        ]);
    }
}
