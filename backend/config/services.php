<?php

declare(strict_types=1);

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'ml' => [
        'base_url' => env('ML_BASE_URL', 'http://localhost:8000'),
        'timeout' => (int) env('ML_TIMEOUT', 10),
    ],

    /*
    |--------------------------------------------------------------------------
    | TMDB (The Movie Database)
    |--------------------------------------------------------------------------
    |
    | Presentation-layer enrichment only (posters, backdrops, overview, cast,
    | trailer, vote_average) — never a hard dependency of the recommendation
    | pipeline. See docs/archeticutre_enhancement/ for the full design.
    |
    */

    'tmdb' => [
        'base_url' => env('TMDB_BASE_URL', 'https://api.themoviedb.org/3'),
        'image_base_url' => env('TMDB_IMAGE_BASE_URL', 'https://image.tmdb.org/t/p'),
        'token' => env('TMDB_API_TOKEN'),
        'timeout' => (int) env('TMDB_TIMEOUT', 5),
        'cache_ttl_hours' => (int) env('TMDB_CACHE_TTL_HOURS', 24),
        'poster_size' => env('TMDB_POSTER_SIZE', 'w500'),
        'backdrop_size' => env('TMDB_BACKDROP_SIZE', 'original'),
    ],

];
