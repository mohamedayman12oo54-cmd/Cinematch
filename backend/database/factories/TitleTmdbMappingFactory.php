<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Enums\TmdbMediaType;
use App\Models\TitleTmdbMapping;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<TitleTmdbMapping>
 */
class TitleTmdbMappingFactory extends Factory
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
            'release_year' => fake()->numberBetween(1990, 2024),
            'tmdb_id' => fake()->unique()->numberBetween(1, 999_999),
            'tmdb_type' => fake()->randomElement(TmdbMediaType::cases()),
            'poster_path' => '/'.fake()->lexify('??????????????????').'.jpg',
            'backdrop_path' => '/'.fake()->lexify('??????????????????').'.jpg',
        ];
    }
}
