<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Helpers\ApiResponse;
use App\Http\Controllers\Concerns\ResolvesAuthUser;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFavoriteRequest;
use App\Http\Resources\FavoriteResource;
use App\Services\FavoriteService;
use Illuminate\Http\JsonResponse;

class FavoriteController extends Controller
{
    use ResolvesAuthUser;

    public function __construct(private readonly FavoriteService $favoriteService) {}

    // GET /api/favorites
    public function index(): JsonResponse
    {
        $favorites = $this->favoriteService->getFavorites($this->user());

        return ApiResponse::success(
            FavoriteResource::collection($favorites),
            extra: ['meta' => ['total' => $favorites->count()]],
        );
    }

    // POST /api/favorites
    public function store(StoreFavoriteRequest $request): JsonResponse
    {
        $result = $this->favoriteService->addFavorite(
            $this->user(),
            $request->string('title_name')->toString(),
        );

        if (! $result['success']) {
            return match ($result['reason']) {
                'not_found' => ApiResponse::error('Title not found', 404),
                'duplicate' => ApiResponse::error('Title already in your Favorites', 422),
            };
        }

        return ApiResponse::created(new FavoriteResource($result['favorite']), 'Added to Favorites');
    }

    // DELETE /api/favorites/{title_name}
    public function destroy(string $title_name): JsonResponse
    {
        $removed = $this->favoriteService->removeFavorite($this->user(), $title_name);

        if (! $removed) {
            return ApiResponse::error('Title not in your Favorites', 404);
        }

        return ApiResponse::success(message: 'Removed from Favorites');
    }
}
