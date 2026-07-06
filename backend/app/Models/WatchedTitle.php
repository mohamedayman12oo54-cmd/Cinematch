<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\TitleType;
use Database\Factories\WatchedTitleFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\WithoutTimestamps;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Override;

#[Fillable(['user_id', 'title_name', 'title_type', 'genres', 'release_year', 'watched_at'])]
#[WithoutTimestamps]
class WatchedTitle extends Model
{
    /** @use HasFactory<WatchedTitleFactory> */
    use HasFactory;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    #[Override]
    protected function casts(): array
    {
        return [
            'title_type' => TitleType::class,
            'release_year' => 'integer',
            'watched_at' => 'datetime',
        ];
    }

    // ======= Relationships =======

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
