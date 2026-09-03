import { env } from "@/server/config/env";
import { logger } from "@/server/observability/logger";
import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";

/**
 * Worker entrypoint (ADR-0010). Same image as the web app, started with
 * `node dist/workers/main.js`. This is the composition root for background work.
 *
 * M1: one repeatable "heartbeat" job proves the queue + scheduler + graceful
 * shutdown. Real processors (fulfil-payment, reconcile-stripe, assert-ledger, …)
 * land in M2 — see src/workers/README.md.
 */
const connection = new IORedis(env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

let lastConnErrorLog = 0;
connection.on("error", (err) => {
  const now = Date.now();
  if (now - lastConnErrorLog > 10_000) {
    lastConnErrorLog = now;
    logger.warn({ err: err.message || err.name }, "worker redis connection error");
  }
});

const HEARTBEAT = "heartbeat";

const heartbeatQueue = new Queue(HEARTBEAT, { connection });

const heartbeatWorker = new Worker(
  HEARTBEAT,
  async (job) => {
    logger.info({ jobId: job.id, name: job.name }, "heartbeat");
  },
  { connection, concurrency: 1 },
);

heartbeatWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "job failed");
});

async function start(): Promise<void> {
  await heartbeatQueue.upsertJobScheduler(
    "heartbeat-every-minute",
    { pattern: "* * * * *" },
    { name: "tick" },
  );
  logger.info({ env: env.APP_ENV ?? "local" }, "worker started");
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "worker shutting down");
  await heartbeatWorker.close();
  await heartbeatQueue.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

start().catch((err) => {
  logger.error({ err }, "worker failed to start");
  process.exit(1);
});
