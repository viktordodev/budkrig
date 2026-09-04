import { env } from "@/server/config/env";
import { logger } from "@/server/observability/logger";
import { queueConnection } from "@/server/queue/connection";
import { MAINTENANCE_JOB, QUEUE, fulfilPaymentPayload, queues } from "@/server/queue/jobs";
import { Worker } from "bullmq";
import { processFulfilPayment } from "./processors/fulfil-payment";
import {
  processAssertLedger,
  processExpirePending,
  processReconcileStripe,
} from "./processors/maintenance";

/**
 * Worker entrypoint (ADR-0010). Same image as the web app, started with
 * `node dist/workers/main.js`. Composition root for background work:
 *  - `fulfilment` queue: `fulfil-payment` jobs from the Stripe webhook
 *  - `maintenance` queue: repeatable expire-pending / assert-ledger /
 *    reconcile-stripe (core-flows Flow 5)
 */
const fulfilmentWorker = new Worker(
  QUEUE.fulfilment,
  async (job) => processFulfilPayment(fulfilPaymentPayload.parse(job.data)),
  { connection: queueConnection, concurrency: 4 },
);

const maintenanceWorker = new Worker(
  QUEUE.maintenance,
  async (job) => {
    switch (job.name) {
      case MAINTENANCE_JOB.expirePending:
        return processExpirePending();
      case MAINTENANCE_JOB.assertLedger:
        return processAssertLedger();
      case MAINTENANCE_JOB.reconcileStripe:
        return processReconcileStripe();
      default:
        logger.warn({ name: job.name }, "maintenance: unknown job");
    }
  },
  { connection: queueConnection, concurrency: 1 },
);

const allWorkers = [fulfilmentWorker, maintenanceWorker];
for (const worker of allWorkers) {
  worker.on("failed", (job, err) => {
    logger.error(
      { queue: worker.name, jobId: job?.id, name: job?.name, err: err.message },
      "job failed",
    );
  });
}

async function start(): Promise<void> {
  const maintenance = queues.maintenance();
  await maintenance.upsertJobScheduler(
    MAINTENANCE_JOB.expirePending,
    { every: 5 * 60_000 },
    { name: MAINTENANCE_JOB.expirePending },
  );
  await maintenance.upsertJobScheduler(
    MAINTENANCE_JOB.assertLedger,
    { pattern: "7 * * * *" },
    { name: MAINTENANCE_JOB.assertLedger },
  );
  await maintenance.upsertJobScheduler(
    MAINTENANCE_JOB.reconcileStripe,
    { pattern: "23 * * * *" },
    { name: MAINTENANCE_JOB.reconcileStripe },
  );
  logger.info({ env: env.APP_ENV ?? "local" }, "worker started");
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "worker shutting down");
  await Promise.all(allWorkers.map((w) => w.close()));
  await Promise.all([queues.fulfilment().close(), queues.maintenance().close()]);
  await queueConnection.quit();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

start().catch((err) => {
  logger.error({ err }, "worker failed to start");
  process.exit(1);
});
