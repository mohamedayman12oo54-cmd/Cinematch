<?php

declare(strict_types=1);

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Override;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    #[Override]
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * Named limiters (docs/security_hardening/02_Implementation_Tree) — one
     * source of truth referenced from routes/api.php as throttle:<name>,
     * instead of the throttle:N,1 magic numbers this project started with.
     */
    private function configureRateLimiting(): void
    {
        RateLimiter::for('login', fn (Request $request): Limit => Limit::perMinute(5)->by($request->ip()));

        RateLimiter::for('register', fn (Request $request): Limit => Limit::perMinute(10)->by($request->ip()));

        RateLimiter::for('public', fn (Request $request): Limit => Limit::perMinute(60)->by($request->ip()));

        RateLimiter::for('protected', fn (Request $request): Limit => Limit::perMinute(100)->by(
            $request->user('api')?->getAuthIdentifier() ?? $request->ip(),
        ));
    }
}
