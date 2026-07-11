export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  if (err.message) return err.message;
  if (err.errors && typeof err.errors === 'object') {
    const first = Object.values(err.errors).flat()[0];
    if (first) return first;
  }
  return fallback;
}

export function isNotFoundError(err) {
  return err?.httpStatus === 404;
}

export function isRateLimitError(err) {
  return err?.httpStatus === 429;
}

export function isServiceUnavailableError(err) {
  return err?.httpStatus === 503;
}
