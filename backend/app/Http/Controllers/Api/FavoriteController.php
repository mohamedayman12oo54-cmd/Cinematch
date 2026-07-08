<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
use App\Http\Controllers\Concerns\HandlesMlErrors;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFavoriteRequest;
use App\Http\Resources\FavoriteResource;
use App\Models\User;
use App\Services\FavoriteService;
use Illuminate\Http\JsonResponse;

class FavoriteController extends Controller
{
    use HandlesMlErrors;

    public function __construct(private readonly FavoriteService $favoriteService) {}

    // GET /api/favorites
    public function index(): JsonResponse
    {
        $favorites = $this->favoriteService->getFavorites($this->user());

        return response()->json([
            'status' => 'success',
            'data' => FavoriteResource::collection($favorites),
            'meta' => ['total' => $favorites->count()],
        ]);
    }

    // POST /api/favorites
    public function store(StoreFavoriteRequest $request): JsonResponse
    {
        try {
            $result = $this->favoriteService->addFavorite(
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
                    'message' => 'Title already in your Favorites',
                ], 422),
            };
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Added to Favorites',
            'data' => new FavoriteResource($result['favorite']),
        ], 201);
    }

    // DELETE /api/favorites/{title_name}
    public function destroy(string $title_name): JsonResponse
    {
        $removed = $this->favoriteService->removeFavorite($this->user(), $title_name);

        if (! $removed) {
            return response()->json([
                'status' => 'error',
                'message' => 'Title not in your Favorites',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Removed from Favorites',
        ]);
    }

    private function user(): User
    {
        /** @var User $user */
        $user = auth('api')->user();

        return $user;
    }
}
