<?php

declare(strict_types=1);

use App\Http\Controllers\Api\Auth\AuthController;
use App\Http\Controllers\Api\SearchController;
use App\Http\Controllers\Api\TitleController;
use Illuminate\Support\Facades\Route;

// ======= Public Auth Routes =======
Route::post('auth/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:5,1');

// ======= Protected Auth Routes =======
Route::middleware(['auth:api', 'throttle:100,1'])->group(function (): void {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::post('auth/refresh', [AuthController::class, 'refresh']);
    Route::get('auth/me', [AuthController::class, 'me']);
});

// ======= Search & Discovery Routes (Public) =======
Route::middleware('throttle:60,1')->group(function (): void {
    Route::get('search', SearchController::class);
    Route::get('titles/{title}', [TitleController::class, 'show']);
    Route::get('recommendations/{title}', [TitleController::class, 'recommendations']);
});
