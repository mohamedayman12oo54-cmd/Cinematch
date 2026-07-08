<?php

declare(strict_types=1);

namespace App\Enums;

use ValueError;

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

    /**
     * Maps the ML layer's human-readable "type" field (e.g. "TV Show") back
     * to the enum, since that's the only form the ML service returns it in.
     */
    public static function fromLabel(string $label): self
    {
        return match ($label) {
            'Movie' => self::Movie,
            'TV Show' => self::TvShow,
            default => throw new ValueError("Unknown title type label: {$label}"),
        };
    }
}
