<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Helpers\ApiResponse;
use App\Http\Controllers\Concerns\ResolvesOptionalAuthUser;
use App\Http\Controllers\Controller;
use App\Services\HomeService;
use Illuminate\Http\JsonResponse;

class HomeController extends Controller
{
    use ResolvesOptionalAuthUser;

    public function __construct(private readonly HomeService $homeService) {}

    // GET /api/home
    public function __invoke(): JsonResponse
    {
        return ApiResponse::success($this->homeService->getHome($this->optionalUser()));
    }
}
