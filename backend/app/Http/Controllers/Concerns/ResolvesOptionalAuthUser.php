<?php

declare(strict_types=1);

namespace App\Http\Controllers\Concerns;

use App\Models\User;
use PHPOpenSourceSaver\JWTAuth\Exceptions\JWTException;

/**
 * For public routes that add extra state when a valid Bearer token happens
 * to be present (docs/features/feature-search-discovery/08_User_Signals_Enrichment.png).
 * A missing token means guest; an invalid/expired one degrades to guest too,
 * rather than failing a route that's documented as public.
 */
trait ResolvesOptionalAuthUser
{
    private function optionalUser(): ?User
    {
        try {
            /** @var User|null $user */
            $user = auth('api')->user();

            return $user;
        } catch (JWTException) {
            return null;
        }
    }
}
