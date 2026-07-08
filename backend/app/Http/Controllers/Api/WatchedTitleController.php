<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
use App\Http\Controllers\Concerns\HandlesMlErrors;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWatchedTitleRequest;
use App\Http\Resources\WatchedTitleResource;
use App\Models\User;
use App\Services\WatchedTitleService;
use Illuminate\Http\JsonResponse;

class WatchedTitleController extends Controller
{
    use HandlesMlErrors;

    public function __construct(private readonly WatchedTitleService $watchedTitleService) {}

    // GET /api/history
    public function index(): JsonResponse
    {
        $history = $this->watchedTitleService->getHistory($this->user());

        return response()->json([
            'status' => 'success',
            'data' => WatchedTitleResource::collection($history),
        ]);
    }

    // POST /api/history
    public function store(StoreWatchedTitleRequest $request): JsonResponse
    {
        try {
            $result = $this->watchedTitleService->addWatched(
                $this->user(),
                $request->string('title_name')->toString(),
            );
        } catch (MlTimeoutException|MlConnectionException $e) {
            return $this->mlErrorResponse($e);
        }

        if (! $result['success']) {
            return match ($result['reason']) {
                'not_found' => response()->json([
                    'status' => 'error',
                    'message' => 'Title not found',
                ], 404),
                'duplicate' => response()->json([
                    'status' => 'error',
                    'message' => 'Title already in your Watch History',
                ], 422),
            };
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Marked as Watched',
            'data' => new WatchedTitleResource($result['watchedTitle']),
        ], 201);
    }

    // DELETE /api/history/{title_name}
    public function destroy(string $title_name): JsonResponse
    {
        $removed = $this->watchedTitleService->removeWatched($this->user(), $title_name);

        if (! $removed) {
            return response()->json([
                'status' => 'error',
                'message' => 'Title not in your Watch History',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Removed from Watch History',
        ]);
    }

    private function user(): User
    {
        /** @var User $user */
        $user = auth('api')->user();

        return $user;
    }
}
