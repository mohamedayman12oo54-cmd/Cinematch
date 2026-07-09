<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Helpers\ApiResponse;
use App\Http\Controllers\Concerns\ResolvesAuthUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWatchedTitleRequest;
use App\Http\Resources\WatchedTitleResource;
use App\Services\WatchedTitleService;
use Illuminate\Http\JsonResponse;

class WatchedTitleController extends Controller
{
    use ResolvesAuthUser;

    public function __construct(private readonly WatchedTitleService $watchedTitleService) {}

    // GET /api/history
    public function index(): JsonResponse
    {
        $history = $this->watchedTitleService->getHistory($this->user());

        return ApiResponse::success(WatchedTitleResource::collection($history));
    }

    // POST /api/history
    public function store(StoreWatchedTitleRequest $request): JsonResponse
    {
        $result = $this->watchedTitleService->addWatched(
            $this->user(),
            $request->string('title_name')->toString(),
        );

        if (! $result['success']) {
            return match ($result['reason']) {
                'not_found' => ApiResponse::error('Title not found', 404),
                'duplicate' => ApiResponse::error('Title already in your Watch History', 422),
            };
        }

        return ApiResponse::created(new WatchedTitleResource($result['watchedTitle']), 'Marked as Watched');
    }

    // DELETE /api/history/{title_name}
    public function destroy(string $title_name): JsonResponse
    {
        $removed = $this->watchedTitleService->removeWatched($this->user(), $title_name);

        if (! $removed) {
            return ApiResponse::error('Title not in your Watch History', 404);
        }

        return ApiResponse::success(message: 'Removed from Watch History');
    }
}
