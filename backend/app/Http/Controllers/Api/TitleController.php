<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api;

use App\Enums\TmdbMediaType;
use App\Helpers\ApiResponse;
use App\Http\Controllers\Concerns\ResolvesOptionalAuthUser;
use App\Http\Controllers\Controller;
use App\Http\Resources\Search\RecommendationResource;
use App\Http\Resources\Search\TitleDetailResource;
use App\Models\User;
use App\Services\MLClientService;
use App\Services\TmdbMappingService;
use App\Services\UserSignalService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TitleController extends Controller
{
    use ResolvesOptionalAuthUser;

    public function __construct(
        private readonly MLClientService $mlClientService,
        private readonly UserSignalService $userSignalService,
        private readonly TmdbMappingService $tmdbMappingService,
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
        $tmdb = $this->resolveTmdb($detail['title'], $detail['release_year'], $detail['type']);

        return ApiResponse::success(new TitleDetailResource($detail, $userSignals, $tmdb));
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

        $cardMetadataByTitle = $this->tmdbMappingService->getCardMetadataForTitles(
            collect($recommendations['results'])
                ->map(fn (array $item): array => [
                    'title' => $item['title'],
                    'release_year' => $item['release_year'] ?? null,
                    'type' => TmdbMediaType::tryFromLabel($item['type']),
                ])
                ->filter(fn (array $entry): bool => $entry['type'] instanceof TmdbMediaType)
                ->all(),
        );

        return ApiResponse::success(new RecommendationResource($recommendations, $signalsByTitle, $cardMetadataByTitle));
    }

    /**
     * Only Title Details gets full TMDB enrichment (poster, backdrop,
     * overview, cast, trailer, vote_average, runtime) — Recommendations
     * and Home only ever need card-level metadata (poster_url +
     * vote_average), which is far cheaper to resolve in bulk (see
     * TmdbMappingService::getCardMetadataForTitles()).
     *
     * Note: unlike the idealized "fire ML + TMDB in parallel" flow in
     * docs/archeticutre_enhancement/15_Full_Flow.svg, this call is
     * sequential after the ML call — the release year (needed to
     * correctly disambiguate remakes/duplicate titles, see the "Remakes"
     * and "Duplicate Titles" edge cases) is only known once ML responds.
     * Searching TMDB by title alone first and validating the year
     * afterward would risk briefly caching a wrong match; the extra
     * round trip here is a deliberate, small correctness-over-latency
     * tradeoff, and is why bulk lookups (where latency matters far more
     * across 10 items) fire in parallel via Http::pool() instead.
     *
     * @return array{poster_url: ?string, backdrop_url: ?string, overview: ?string, vote_average: ?float, runtime: ?int, cast: array<int, string>, trailer_key: ?string, tmdb_available: bool}
     */
    private function resolveTmdb(string $title, ?int $releaseYear, string $mlTypeLabel): array
    {
        $type = TmdbMediaType::tryFromLabel($mlTypeLabel);

        if (! $type instanceof TmdbMediaType) {
            return $this->tmdbMappingService->unavailable();
        }

        return $this->tmdbMappingService->resolve($title, $releaseYear, $type);
    }
}
