<?php

declare(strict_types=1);

namespace App\Enums;

use ValueError;

enum TmdbMediaType: string
{
    case Movie = 'movie';
    case Tv = 'tv';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    /**
     * Maps the ML layer's TitleType (movie/tv_show) to the vocabulary TMDB's
     * own search/details endpoints expect (movie/tv) — see the "Movie vs TV
     * Show Conflict" edge case (docs/archeticutre_enhancement/10_Q8_EdgeCases.svg):
     * the ML type is always used to pick which TMDB endpoint to query,
     * rather than trusting TMDB's own multi-search to disambiguate.
     */
    public static function fromTitleType(TitleType $type): self
    {
        return match ($type) {
            TitleType::Movie => self::Movie,
            TitleType::TvShow => self::Tv,
        };
    }

    /**
     * Convenience wrapper around fromTitleType() + TitleType::fromLabel()
     * for callers that only have ML's raw label ("Movie" / "TV Show") and
     * want TMDB enrichment to degrade gracefully — rather than throw — for
     * a label ML isn't documented to send.
     */
    public static function tryFromLabel(string $label): ?self
    {
        try {
            return self::fromTitleType(TitleType::fromLabel($label));
        } catch (ValueError) {
            return null;
        }
    }
}
