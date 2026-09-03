import { env } from "@/server/config/env";
import { logger } from "@/server/observability/logger";
import Redis from "ioredis";

/**
 * Shared Redis client for the web app: cache, rate limiting, presence
 * (ADR-0009 / ADR-0010). `lazyConnect` keeps module import side-effect-free so
 * `next build` doesn't try to dial Redis. BullMQ uses its own connection in the
 * worker.
 */
export const redis = new Redis(env.REDIS_URL ?? "redis://localhost:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
});

// Without a listener, ioredis "error" events become unhandled exceptions.
// Throttle so a Redis outage doesn't flood the logs.
let lastRedisErrorLog = 0;
redis.on("error", (err) => {
  const now = Date.now();
  if (now - lastRedisErrorLog > 10_000) {
    lastRedisErrorLog = now;
    logger.warn({ err: err.message || err.name }, "redis connection error");
  }
});

/** Connect-if-needed then PING. Throws if Redis is unreachable. */
export async function pingRedis(): Promise<void> {
  if (redis.status === "wait" || redis.status === "close" || redis.status === "end") {
    await redis.connect();
  }
  await redis.ping();
}
