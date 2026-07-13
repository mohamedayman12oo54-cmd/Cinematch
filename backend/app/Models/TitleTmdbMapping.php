<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TitleTmdbMapping extends Model
{

    protected $fillable = [
        'title_name',
        'release_year',
        'tmdb_id',
        'tmdb_type',
        'poster_path',
        'backdrop_path',
    ];

    protected function casts(): array
    {
        return [
            'tmdb_id'      => 'integer',
            'release_year' => 'integer',
        ];
    }

}
