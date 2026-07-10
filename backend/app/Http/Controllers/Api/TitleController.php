<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Helpers\ApiResponse;
use App\Http\Controllers\Concerns\ResolvesOptionalAuthUser;
use App\Http\Controllers\Controller;
use App\Http\Resources\Search\RecommendationResource;
use App\Http\Resources\Search\TitleDetailResource;
use App\Models\User;
use App\Services\MLClientService;
use App\Services\UserSignalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TitleController extends Controller
{
    use ResolvesOptionalAuthUser;

    public function __construct(
        private readonly MLClientService $mlClientService,
        private readonly UserSignalService $userSignalService,
    ) {}

    // GET /api/titles/{title}
    public function show(string $title): JsonResponse
    {
        $detail = $this->mlClientService->getTitleDetail($title);

        if ($detail === null) {
            return ApiResponse::error('Title not found', 404);
        }

        $user = $this->optionalUser();
        $userSignals = $user instanceof User ? $this->userSignalService->signalsFor($user, $detail['title']) : null;

        return ApiResponse::success(new TitleDetailResource($detail, $userSignals));
    }

    // GET /api/recommendations/{title}
    public function recommendations(Request $request, string $title): JsonResponse
    {
        $recommendations = $this->mlClientService->getRecommendations(
            $title,
            (int) $request->input('n', 10),
        );

        if ($recommendations === null) {
            return ApiResponse::error('Title not found', 404);
        }

        $user = $this->optionalUser();
        $signalsByTitle = $user instanceof User
            ? $this->userSignalService->signalsForMany($user, array_column($recommendations['results'], 'title'))
            : null;

        return ApiResponse::success(new RecommendationResource($recommendations, $signalsByTitle));
    }
}
