<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/**
 * The ML service took longer than ML_TIMEOUT to respond (docs/features/feature-search-discovery/09_Error_Handling_ML.png, Case 3).
 */
class MlTimeoutException extends RuntimeException {}
