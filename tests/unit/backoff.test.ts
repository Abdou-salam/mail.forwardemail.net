import { describe, it, expect, vi, afterEach } from 'vitest';
import { exponentialBackoff } from '../../src/utils/backoff.js';

// Constants used by the two real consumers.
const MUTATION = { baseMs: 3000, maxMs: 2 * 60 * 1000 };
const OUTBOX = { baseMs: 5000, maxMs: 5 * 60 * 1000 };

afterEach(() => vi.restoreAllMocks());

describe('exponentialBackoff', () => {
  it('returns baseMs for retry 0 with no jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(exponentialBackoff(0, MUTATION)).toBe(3000);
    expect(exponentialBackoff(0, OUTBOX)).toBe(5000);
  });

  it('doubles with each retry (2^n) until capped at maxMs', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(exponentialBackoff(1, MUTATION)).toBe(6000);
    expect(exponentialBackoff(2, MUTATION)).toBe(12000);
    expect(exponentialBackoff(3, MUTATION)).toBe(24000);
    // 3000 * 2^10 = 3_072_000, well past the 120_000 cap.
    expect(exponentialBackoff(10, MUTATION)).toBe(MUTATION.maxMs);
    expect(exponentialBackoff(20, OUTBOX)).toBe(OUTBOX.maxMs);
  });

  it('adds at most 20% jitter (default) on top of the delay', () => {
    // random = 1 → full jitter.
    vi.spyOn(Math, 'random').mockReturnValue(1);
    // retry 0: 3000 + 3000 * 1 * 0.2 = 3600
    expect(exponentialBackoff(0, MUTATION)).toBe(3600);
    // retry 2: 12000 * 1.2 = 14400
    expect(exponentialBackoff(2, MUTATION)).toBe(14400);
  });

  it('scales jitter with the random value and floors to an integer', () => {
    // 0.125 (1/8) is exact in floating point, so the pre-floor value is exactly
    // 100 + 100 * 0.125 * 0.2 = 102.5 → floored to 102 (no boundary ambiguity).
    vi.spyOn(Math, 'random').mockReturnValue(0.125);
    const out = exponentialBackoff(0, { baseMs: 100, maxMs: 1000, jitter: 0.2 });
    expect(out).toBe(102);
    expect(Number.isInteger(out)).toBe(true);
  });

  it('keeps any result within [delay, delay * 1.2] for random in [0, 1)', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      vi.spyOn(Math, 'random').mockReturnValue(r);
      const delay = Math.min(OUTBOX.baseMs * 2 ** 3, OUTBOX.maxMs); // retry 3
      const out = exponentialBackoff(3, OUTBOX);
      expect(out).toBeGreaterThanOrEqual(delay);
      expect(out).toBeLessThanOrEqual(Math.floor(delay * 1.2));
      vi.restoreAllMocks();
    }
  });

  it('honors a custom jitter factor', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    // jitter 0 → exactly the delay
    expect(exponentialBackoff(1, { ...MUTATION, jitter: 0 })).toBe(6000);
    // jitter 0.5 → 6000 * 1.5 = 9000
    expect(exponentialBackoff(1, { ...MUTATION, jitter: 0.5 })).toBe(9000);
  });
});
