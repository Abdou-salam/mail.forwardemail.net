/**
 * Exponential backoff with jitter — the shared retry-delay formula used by the
 * offline mutation queue and the outbox sender. Both previously inlined an
 * identical copy; this is the single source of truth.
 *
 * delay = min(baseMs * 2^retryCount, maxMs)
 * result = floor(delay + delay * random() * jitter)
 *
 * @param {number} retryCount  Zero-based attempt number.
 * @param {{ baseMs: number, maxMs: number, jitter?: number }} options
 *   baseMs  Delay for retry 0 (before jitter).
 *   maxMs   Upper bound on the pre-jitter delay.
 *   jitter  Fraction of the delay added as random jitter (default 0.2 = 20%).
 * @returns {number} Delay in whole milliseconds.
 */
export function exponentialBackoff(retryCount, { baseMs, maxMs, jitter = 0.2 } = {}) {
  const delay = Math.min(baseMs * Math.pow(2, retryCount), maxMs);
  return Math.floor(delay + delay * Math.random() * jitter);
}
