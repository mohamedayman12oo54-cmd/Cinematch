<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\TitleType;
use App\Models\WatchedTitle;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<WatchedTitle>
 */
class WatchedTitleFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'title_name' => fake()->unique()->sentence(3),
            'title_type' => fake()->randomElement(TitleType::cases()),
            'genres' => implode(', ', fake()->randomElements(
                ['Drama', 'Comedy', 'Action', 'Sci-Fi', 'Thriller', 'Crime', 'Romance'],
                fake()->numberBetween(1, 3)
            )),
            'release_year' => fake()->numberBetween(1990, 2024),
            'watched_at' => fake()->dateTimeBetween('-1 year'),
        ];
    }
}
