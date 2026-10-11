import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison for shared secrets.
 *
 * Both sides are hashed first so inputs of different length do not leak that
 * fact through an early return.
 */
export function secureCompare(actual: string, expected: string): boolean {
  const actualDigest = createHash('sha256').update(actual).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}
