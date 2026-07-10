<?php

declare(strict_types=1);

namespace App\Http\Controllers\Concerns;

use App\Models\User;

/**
 * For protected routes (behind auth:api) where the authenticated user is
 * guaranteed to be present — unlike ResolvesOptionalAuthUser, which is for
 * public routes that merely add extra state when a token happens to exist.
 */
trait ResolvesAuthUser
{
    private function user(): User
    {
        /** @var User $user */
        $user = auth('api')->user();

        return $user;
    }
}
