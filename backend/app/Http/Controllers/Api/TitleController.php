<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Exceptions\MlConnectionException;
use App\Exceptions\MlTimeoutException;
use App\Http\Controllers\Concerns\HandlesMlErrors;
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
    use HandlesMlErrors;
    use ResolvesOptionalAuthUser;

    public function __construct(
        private readonly MLClientService $mlClientService,
        private readonly UserSignalService $userSignalService,
    ) {}

    // GET /api/titles/{title}
    public function show(string $title): JsonResponse
    {
        try {
            $detail = $this->mlClientService->getTitleDetail($title);
        } catch (MlTimeoutException|MlConnectionException $e) {
            return $this->mlErrorResponse($e);
        }

        if ($detail === null) {
            return response()->json([
                'status' => 'error',
                'message' => 'Title not found',
            ], 404);
        }

        $user = $this->optionalUser();
        $userSignals = $user instanceof User ? $this->userSignalService->signalsFor($user, $detail['title']) : null;

        return response()->json([
            'status' => 'success',
            'data' => new TitleDetailResource($detail, $userSignals),
        ]);
    }

    // GET /api/recommendations/{title}
    public function recommendations(Request $request, string $title): JsonResponse
    {
        try {
            $recommendations = $this->mlClientService->getRecommendations(
                $title,
                (int) $request->input('n', 10),
            );
        } catch (MlTimeoutException|MlConnectionException $e) {
            return $this->mlErrorResponse($e);
        }

        if ($recommendations === null) {
            return response()->json([
                'status' => 'error',
                'message' => 'Title not found',
            ], 404);
        }

        $user = $this->optionalUser();
        $signalsByTitle = $user instanceof User
            ? $this->userSignalService->signalsForMany($user, array_column($recommendations['results'], 'title'))
            : null;

        return response()->json([
            'status' => 'success',
            'data' => new RecommendationResource($recommendations, $signalsByTitle),
        ]);
    }
}
