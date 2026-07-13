<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\TmdbMediaType;
use Database\Factories\TitleTmdbMappingFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Override;

/**
 * Persists the title → TMDB record match so it never has to be re-resolved
 * via a TMDB search call again (see TmdbMappingService). poster_path /
 * backdrop_path are stored as TMDB's own relative paths, not full URLs —
 * the image base URL and size are applied at response time (TmdbService),
 * so a size change never requires a migration or backfill.
 */
#[Fillable(['title_name', 'release_year', 'tmdb_id', 'tmdb_type', 'poster_path', 'backdrop_path'])]
class TitleTmdbMapping extends Model
{
    /** @use HasFactory<TitleTmdbMappingFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    #[Override]
    protected function casts(): array
    {
        return [
            'release_year' => 'integer',
            'tmdb_id' => 'integer',
            'tmdb_type' => TmdbMediaType::class,
        ];
    }
}
