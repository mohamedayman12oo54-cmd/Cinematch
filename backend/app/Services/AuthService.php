<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\Auth;
use PHPOpenSourceSaver\JWTAuth\JWTGuard;

class AuthService
{
    // ======= Register =======

    /**
     * @param  array{email: string, password: string}  $data
     * @return array{user: User, token: string, stage: string}
     */
    public function register(array $data): array
    {
        $user = User::create([
            'email' => $data['email'],
            'password' => $data['password'],
        ]);

        $token = $this->guard()->login($user);

        return [
            'user' => $user,
            'token' => $token,
            'stage' => $this->resolveStage($user),
        ];
    }

    // ======= Login =======

    /**
     * @param  array{email: string, password: string}  $credentials
     * @return array{success: bool, user?: User, token?: string, stage?: string}
     */
    public function login(array $credentials): array
    {
        if (! $token = $this->guard()->attempt($credentials)) {
            return ['success' => false];
        }

        /** @var User $user */
        $user = $this->guard()->user();

        return [
            'success' => true,
            'user' => $user,
            'token' => $token,
            'stage' => $this->resolveStage($user),
        ];
    }

    // ======= Logout =======

    public function logout(): void
    {
        $this->guard()->logout();
    }

    // ======= Refresh =======

    /**
     * @return array{user: User, token: string, stage: string}
     */
    public function refresh(User $user): array
    {
        $token = $this->guard()->refresh();

        return [
            'user' => $user,
            'token' => $token,
            'stage' => $this->resolveStage($user),
        ];
    }

    // ======= Current User =======

    /**
     * @return array{user: User, stage: string}
     */
    public function me(User $user): array
    {
        return [
            'user' => $user,
            'stage' => $this->resolveStage($user),
        ];
    }

    // ======= User Stage Calculation =======

    /**
     * Derived attribute, never persisted (docs/database/07_db_decisions.png).
     * Computed here, in the Service Layer, from the user's signal count.
     */
    public function resolveStage(User $user): string
    {
        $signalCount = $user->favorites()->count() + $user->watchedTitles()->count();

        return match (true) {
            $signalCount === 0 => 'stranger',
            $signalCount < 5 => 'explorer',
            $signalCount < 20 => 'regular',
            default => 'loyal',
        };
    }

    // ======= Helpers =======

    private function guard(): JWTGuard
    {
        /** @var JWTGuard $guard */
        $guard = Auth::guard('api');

        return $guard;
    }
}
