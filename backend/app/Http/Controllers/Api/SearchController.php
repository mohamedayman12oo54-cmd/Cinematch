<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
use App\Http\Controllers\Concerns\HandlesMlErrors;
use App\Http\Controllers\Controller;
use App\Http\Requests\SearchRequest;
use App\Http\Resources\Search\SearchResultResource;
use App\Services\MLClientService;
use Illuminate\Http\JsonResponse;

class SearchController extends Controller
{
    use HandlesMlErrors;

    public function __construct(private readonly MLClientService $mlClientService) {}

    // GET /api/search
    public function __invoke(SearchRequest $request): JsonResponse
    {
        try {
            $results = $this->mlClientService->search(
                $request->string('q')->toString(),
                (int) $request->input('limit', 12),
            );
        } catch (MlTimeoutException|MlConnectionException $e) {
            return $this->mlErrorResponse($e);
        }

        return response()->json([
            'status' => 'success',
            'data' => SearchResultResource::collection($results),
        ]);
    }
}
