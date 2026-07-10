<?php

declare(strict_types=1);

namespace Database\Seeders\Support;

use App\Enums\TitleType;

/**
 * Curated, fixed catalogue of titles used to build intentional Favorites /
 * Watched History testing data.
 *
 * These are metadata snapshots only (matching what the ML layer would have
 * returned at write time) — this project never stores real title records in
 * the database, so this pool exists solely to give seeded rows realistic,
 * stable, non-random values.
 */
final class TitlePool
{
    /**
     * @return array<int, array{title_name: string, title_type: TitleType, genres: string, release_year: int}>
     */
    public static function movies(): array
    {
        return [
            self::title('Inception', TitleType::Movie, 'Sci-Fi, Thriller, Action', 2010),
            self::title('The Dark Knight', TitleType::Movie, 'Action, Crime, Drama', 2008),
            self::title('Interstellar', TitleType::Movie, 'Sci-Fi, Drama, Adventure', 2014),
            self::title('Parasite', TitleType::Movie, 'Thriller, Drama, Comedy', 2019),
            self::title('The Grand Budapest Hotel', TitleType::Movie, 'Comedy, Drama', 2014),
            self::title('Mad Max: Fury Road', TitleType::Movie, 'Action, Adventure, Sci-Fi', 2015),
            self::title('Whiplash', TitleType::Movie, 'Drama, Music', 2014),
            self::title('Get Out', TitleType::Movie, 'Horror, Thriller, Mystery', 2017),
            self::title('La La Land', TitleType::Movie, 'Comedy, Drama, Romance, Music', 2016),
            self::title('The Social Network', TitleType::Movie, 'Drama, Biography', 2010),
            self::title('Knives Out', TitleType::Movie, 'Comedy, Crime, Mystery', 2019),
            self::title('Dune', TitleType::Movie, 'Sci-Fi, Adventure, Drama', 2021),
            self::title('Everything Everywhere All at Once', TitleType::Movie, 'Sci-Fi, Comedy, Action', 2022),
            self::title('The Shawshank Redemption', TitleType::Movie, 'Drama', 1994),
            self::title('Pulp Fiction', TitleType::Movie, 'Crime, Drama', 1994),
            self::title('Fight Club', TitleType::Movie, 'Drama, Thriller', 1999),
            self::title('The Matrix', TitleType::Movie, 'Sci-Fi, Action', 1999),
            self::title('Gladiator', TitleType::Movie, 'Action, Drama, Adventure', 2000),
            self::title('No Country for Old Men', TitleType::Movie, 'Crime, Drama, Thriller', 2007),
            self::title('Arrival', TitleType::Movie, 'Sci-Fi, Drama, Mystery', 2016),
            self::title('Blade Runner 2049', TitleType::Movie, 'Sci-Fi, Drama, Thriller', 2017),
            self::title('The Prestige', TitleType::Movie, 'Drama, Mystery, Sci-Fi', 2006),
            self::title('Coco', TitleType::Movie, 'Animation, Family, Music', 2017),
            self::title('Spirited Away', TitleType::Movie, 'Animation, Fantasy, Adventure', 2001),
            self::title('Django Unchained', TitleType::Movie, 'Western, Drama', 2012),
            self::title('The Wolf of Wall Street', TitleType::Movie, 'Biography, Crime, Comedy', 2013),
            self::title('Joker', TitleType::Movie, 'Crime, Drama, Thriller', 2019),
            self::title('1917', TitleType::Movie, 'War, Drama, Action', 2019),
            self::title('Oppenheimer', TitleType::Movie, 'Biography, Drama, History', 2023),
            self::title('Barbie', TitleType::Movie, 'Comedy, Adventure, Fantasy', 2023),
        ];
    }

    /**
     * @return array<int, array{title_name: string, title_type: TitleType, genres: string, release_year: int}>
     */
    public static function tvShows(): array
    {
        return [
            self::title('Breaking Bad', TitleType::TvShow, 'Crime, Drama, Thriller', 2008),
            self::title('Stranger Things', TitleType::TvShow, 'Sci-Fi, Horror, Drama', 2016),
            self::title('The Crown', TitleType::TvShow, 'Drama, History, Biography', 2016),
            self::title('Narcos', TitleType::TvShow, 'Crime, Drama, Biography', 2015),
            self::title('Ozark', TitleType::TvShow, 'Crime, Drama, Thriller', 2017),
            self::title('Better Call Saul', TitleType::TvShow, 'Crime, Drama', 2015),
            self::title('Peaky Blinders', TitleType::TvShow, 'Crime, Drama', 2013),
            self::title('House of Cards', TitleType::TvShow, 'Drama, Political Thriller', 2013),
            self::title('Dark', TitleType::TvShow, 'Sci-Fi, Mystery, Thriller', 2017),
            self::title('The Witcher', TitleType::TvShow, 'Fantasy, Adventure, Drama', 2019),
            self::title('Black Mirror', TitleType::TvShow, 'Sci-Fi, Anthology, Drama', 2011),
            self::title('The Mandalorian', TitleType::TvShow, 'Sci-Fi, Adventure, Action', 2019),
            self::title('Succession', TitleType::TvShow, 'Drama, Comedy', 2018),
            self::title('The Bear', TitleType::TvShow, 'Comedy, Drama', 2022),
            self::title('Fleabag', TitleType::TvShow, 'Comedy, Drama', 2016),
            self::title('The Office', TitleType::TvShow, 'Comedy', 2005),
            self::title('Chernobyl', TitleType::TvShow, 'Drama, History, Thriller', 2019),
            self::title('Money Heist', TitleType::TvShow, 'Crime, Drama, Thriller', 2017),
            self::title('The Last of Us', TitleType::TvShow, 'Drama, Horror, Sci-Fi', 2023),
            self::title('Wednesday', TitleType::TvShow, 'Comedy, Fantasy, Mystery', 2022),
        ];
    }

    /**
     * @return array<int, array{title_name: string, title_type: TitleType, genres: string, release_year: int}>
     */
    public static function all(): array
    {
        return [...self::movies(), ...self::tvShows()];
    }

    /**
     * @return array{title_name: string, title_type: TitleType, genres: string, release_year: int}
     */
    private static function title(string $name, TitleType $type, string $genres, int $year): array
    {
        return [
            'title_name' => $name,
            'title_type' => $type,
            'genres' => $genres,
            'release_year' => $year,
        ];
    }
}
