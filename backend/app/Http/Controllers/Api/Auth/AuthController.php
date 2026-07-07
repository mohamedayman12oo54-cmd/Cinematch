<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Services\AuthService;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $authService) {}

    // POST /api/auth/register
    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());

        return response()->json([
            'status' => 'success',
            'message' => 'Account created',
            'data' => $this->tokenPayload($result['user'], $result['stage'], $result['token']),
        ], 201);
    }

    // POST /api/auth/login
    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login($request->validated());

        if (! $result['success']) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid credentials',
            ], 401);
        }

        return response()->json([
            'status' => 'success',
            'data' => $this->tokenPayload($result['user'], $result['stage'], $result['token']),
        ]);
    }

    // POST /api/auth/logout
    public function logout(): JsonResponse
    {
        $this->authService->logout();

        return response()->json([
            'status' => 'success',
            'message' => 'Successfully logged out',
        ]);
    }

    // POST /api/auth/refresh
    public function refresh(): JsonResponse
    {
        /** @var User $user */
        $user = auth('api')->user();

        $result = $this->authService->refresh($user);

        return response()->json([
            'status' => 'success',
            'data' => $this->tokenPayload($result['user'], $result['stage'], $result['token']),
        ]);
    }

    // GET /api/auth/me
    public function me(): JsonResponse
    {
        /** @var User $user */
        $user = auth('api')->user();

        $result = $this->authService->me($user);

        return response()->json([
            'status' => 'success',
            'data' => [
                'user' => UserResource::make($result['user'], $result['stage']),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function tokenPayload(User $user, string $stage, string $token): array
    {
        return [
            'user' => UserResource::make($user, $stage),
            'token' => $token,
            'token_type' => 'bearer',
            'expires_in' => config('jwt.ttl') * 60,
        ];
    }
}
