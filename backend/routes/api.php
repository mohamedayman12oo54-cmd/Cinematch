<?php

declare(strict_types=1);

use App\Http\Controllers\Api\Auth\AuthController;
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
