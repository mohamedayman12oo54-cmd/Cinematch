<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Helpers\ApiResponse;
use App\Http\Controllers\Controller;
use App\Http\Requests\SearchRequest;
use App\Http\Resources\Search\SearchResultResource;
use App\Services\MLClientService;
use Illuminate\Http\JsonResponse;

class SearchController extends Controller
{
    public function __construct(private readonly MLClientService $mlClientService) {}

    // GET /api/search
    public function __invoke(SearchRequest $request): JsonResponse
    {
        $results = $this->mlClientService->search(
            $request->string('q')->toString(),
            (int) $request->input('limit', 12),
        );

        return ApiResponse::success(SearchResultResource::collection($results));
    }
}
