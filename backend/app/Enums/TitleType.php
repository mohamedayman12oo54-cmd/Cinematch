<?php

declare(strict_types=1);

namespace App\Enums;

enum TitleType: string
{
    case Movie = 'movie';
    case TvShow = 'tv_show';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public function label(): string
    {
        return match ($this) {
            self::Movie => 'Movie',
            self::TvShow => 'TV Show',
        };
    }
}
