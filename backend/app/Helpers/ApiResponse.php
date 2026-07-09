<?php

declare(strict_types=1);

namespace App\Helpers;

use Illuminate\Http\JsonResponse;

/**
 * The single source of truth for the API's response envelope
 * (docs/security_hardening/02_Implementation_Tree). Every controller and
 * the global exception handler go through this — no endpoint constructs a
 * raw response()->json([...]) after this phase.
 */
class ApiResponse
{
    /**
     * @param  array<string, mixed>  $extra  merged onto the top-level payload (e.g. 'meta' => [...])
     */
    public static function success(mixed $data = null, ?string $message = null, int $status = 200, array $extra = []): JsonResponse
    {
        $payload = ['status' => 'success'];

        if ($message !== null) {
            $payload['message'] = $message;
        }

        if ($data !== null) {
            $payload['data'] = $data;
        }

        return response()->json([...$payload, ...$extra], $status);
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    public static function created(mixed $data = null, ?string $message = null, array $extra = []): JsonResponse
    {
        return self::success($data, $message, 201, $extra);
    }

    /**
     * @param  array<string, array<int, string>>|null  $errors  per-field validation messages
     */
    public static function error(string $message, int $status = 400, ?array $errors = null): JsonResponse
    {
        $payload = ['status' => 'error', 'message' => $message];

        if ($errors !== null) {
            $payload['errors'] = $errors;
        }

        return response()->json($payload, $status);
    }
}
