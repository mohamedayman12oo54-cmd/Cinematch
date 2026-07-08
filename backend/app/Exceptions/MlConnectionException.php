<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/**
 * The ML service is down or unreachable (docs/features/feature-search-discovery/09_Error_Handling_ML.png, Case 1).
 */
class MlConnectionException extends RuntimeException {}
