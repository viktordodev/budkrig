import { redis } from "./client";

export interface RateLimitResult {
  readonly ok: boolean;
  readonly remaining: number;
  readonly resetSec: number;
}

/**
 * Fixed-window limiter (INCR + EXPIRE). Good enough for abuse control on the
 * claim + manage-link endpoints (ADR-0008 / ADR-0012). Fails OPEN if Redis is
 * unreachable — a claim shouldn't be blocked by a cache outage.
 */
export async function rateLimit(
  key: string,
  opts: { limit: number; windowSec: number },
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  try {
    const count = await redis.incr(redisKey);
    if (count === 1) await redis.expire(redisKey, opts.windowSec);
    const ttl = await redis.ttl(redisKey);
    return {
      ok: count <= opts.limit,
      remaining: Math.max(0, opts.limit - count),
      resetSec: ttl >= 0 ? ttl : opts.windowSec,
    };
  } catch {
    return { ok: true, remaining: opts.limit, resetSec: opts.windowSec };
  }
}
