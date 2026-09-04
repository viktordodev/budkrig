import { env } from "@/server/config/env";
import { logger } from "@/server/observability/logger";
import IORedis from "ioredis";

/**
 * Shared BullMQ connection. `maxRetriesPerRequest: null` is required by BullMQ;
 * `lazyConnect` keeps importing the job registry (e.g. from the webhook route)
 * side-effect-free so `next build` doesn't dial Redis.
 */
export const queueConnection = new IORedis(env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

let lastErrorLog = 0;
queueConnection.on("error", (err) => {
  const now = Date.now();
  if (now - lastErrorLog > 10_000) {
    lastErrorLog = now;
    logger.warn({ err: err.message || err.name }, "queue redis connection error");
  }
});
