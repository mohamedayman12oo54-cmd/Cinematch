<?php

declare(strict_types=1);

namespace App\Exceptions;

use App\Helpers\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Throwable;

/**
 * Maps every exception type the API can throw onto the ApiResponse envelope
 * (docs/security_hardening/02_Implementation_Tree). Registered from
 * bootstrap/app.php's withExceptions() — this project targets Laravel 13,
 * which replaced the old app/Exceptions/Handler.php class the playbook's
 * implementation tree names with this closure-based configuration API, so
 * "written" and "wired up" collapse into a single step here rather than
 * the two separate commits the pre-Laravel-11 playbook describes.
 *
 * Priority order matches the playbook exactly: ModelNotFoundException →
 * route NotFoundHttpException → AuthenticationException →
 * AuthorizationException → ValidationException →
 * TooManyRequestsHttpException → this app's Ml* exceptions → catch-all.
 */
class ApiExceptionRenderer
{
    public static function register(Exceptions $exceptions): void
    {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->is('api/*'),
        );

        $exceptions->render(fn (ModelNotFoundException $e, Request $request): ?JsonResponse => self::forApi(
            $request,
            fn () => ApiResponse::error('Resource not found', 404),
        ));

        $exceptions->render(fn (NotFoundHttpException $e, Request $request): ?JsonResponse => self::forApi(
            $request,
            fn () => ApiResponse::error('Endpoint not found', 404),
        ));

        $exceptions->render(fn (AuthenticationException $e, Request $request): ?JsonResponse => self::forApi(
            $request,
            fn () => ApiResponse::error('Unauthenticated', 401),
        ));

        $exceptions->render(fn (AuthorizationException $e, Request $request): ?JsonResponse => self::forApi(
            $request,
            fn () => ApiResponse::error('This action is unauthorized', 403),
        ));

        $exceptions->render(fn (ValidationException $e, Request $request): ?JsonResponse => self::forApi(
            $request,
            fn () => ApiResponse::error('The given data was invalid.', 422, $e->errors()),
        ));

        $exceptions->render(fn (ThrottleRequestsException $e, Request $request): ?JsonResponse => self::forApi(
            $request,
            fn () => ApiResponse::error('Too many requests. Please try again later.', 429)
                ->withHeaders($e->getHeaders()),
        ));

        $exceptions->render(fn (MlConnectionException $e, Request $request): ?JsonResponse => self::forApi(
            $request,
            fn () => ApiResponse::error('Service not available right now', 503),
        ));

        $exceptions->render(fn (MlTimeoutException $e, Request $request): ?JsonResponse => self::forApi(
            $request,
            fn () => ApiResponse::error('Service took too long', 504),
        ));

        $exceptions->render(fn (Throwable $e, Request $request): ?JsonResponse => self::forApi(
            $request,
            fn () => ApiResponse::error(
                app()->environment('production') ? 'Something went wrong' : $e->getMessage(),
                500,
            ),
        ));
    }

    /**
     * Every renderer above only applies to api/* requests — anything else
     * falls through to Laravel's default handling (Blade error pages, etc).
     *
     * @param  callable(): JsonResponse  $respond
     */
    private static function forApi(Request $request, callable $respond): ?JsonResponse
    {
        return $request->is('api/*') ? $respond() : null;
    }
}
