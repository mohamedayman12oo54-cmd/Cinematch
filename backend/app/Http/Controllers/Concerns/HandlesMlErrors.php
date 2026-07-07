<?php

declare(strict_types=1);

namespace App\Http\Controllers\Concerns;

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
use Illuminate\Http\JsonResponse;

/**
 * Maps ML integration failures to the documented error contract
 * (docs/features/feature-search-discovery/09_Error_Handling_ML.png).
 */
trait HandlesMlErrors
{
    private function mlErrorResponse(MlTimeoutException|MlConnectionException $e): JsonResponse
    {
        if ($e instanceof MlTimeoutException) {
            return response()->json([
                'status' => 'error',
                'message' => 'Service took too long',
            ], 504);
        }

        return response()->json([
            'status' => 'error',
            'message' => 'Service not available right now',
        ], 503);
    }
}
