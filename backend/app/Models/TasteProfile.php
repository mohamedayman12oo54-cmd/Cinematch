<?php

declare(strict_types=1);

namespace App\Models;

use Database\Factories\TasteProfileFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\WithoutTimestamps;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Override;

#[Fillable(['user_id', 'genre_weights', 'last_calculated'])]
#[WithoutTimestamps]
class TasteProfile extends Model
{
    /** @use HasFactory<TasteProfileFactory> */
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
            'genre_weights' => 'array',
            'last_calculated' => 'datetime',
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
