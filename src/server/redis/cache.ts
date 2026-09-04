import { redis } from "./client";

/**
 * Read-through cache with a short TTL (ADR-0009). Bounds DB load during a spike:
 * N readers cost ~1 query per TTL window. Fails OPEN — a Redis outage falls
 * back to the live query, never an error.
 */
export async function cached<T>(key: string, ttlSec: number, load: () => Promise<T>): Promise<T> {
  try {
    const hit = await redis.get(`cache:${key}`);
    if (hit != null) return JSON.parse(hit) as T;
  } catch {
    // fall through to the live load
  }

  const value = await load();

  try {
    await redis.set(`cache:${key}`, JSON.stringify(value), "EX", ttlSec);
  } catch {
    // best effort
  }
  return value;
}

export async function invalidateCache(...keys: string[]): Promise<void> {
  try {
    if (keys.length > 0) await redis.del(...keys.map((k) => `cache:${k}`));
  } catch {
    // best effort — the TTL will expire it anyway
  }
}

export const CACHE_KEYS = {
  board: (view: "all" | "today", categorySlug?: string) =>
    `board:${view}:${categorySlug ?? "_"}:v1`,
} as const;
