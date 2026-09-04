import { Queue } from "bullmq";
import { z } from "zod";
import { queueConnection } from "./connection";

/**
 * Job registry (ADR-0010). One place: queue names, payload schemas, typed
 * enqueue helpers. Every payload is Zod-validated on the way in and out; every
 * job carries an explicit idempotency `jobId`.
 *
 * Queues are built lazily so importing this module (e.g. from the webhook
 * route) doesn't dial Redis during `next build`.
 */
export const QUEUE = {
  fulfilment: "fulfilment",
  maintenance: "maintenance",
} as const;

export const MAINTENANCE_JOB = {
  expirePending: "expire-pending",
  assertLedger: "assert-ledger",
  reconcileStripe: "reconcile-stripe",
} as const;

export const fulfilPaymentPayload = z.object({
  provider: z.literal("stripe"),
  providerEventId: z.string(),
  providerPaymentIntent: z.string(),
  method: z.enum(["card", "swish", "klarna", "wallet", "other"]),
  eventKey: z.string(),
  type: z.string(),
  payload: z.unknown(),
});
export type FulfilPaymentPayload = z.infer<typeof fulfilPaymentPayload>;

let fulfilmentQueue: Queue | null = null;
let maintenanceQueue: Queue | null = null;

function getFulfilmentQueue(): Queue {
  fulfilmentQueue ??= new Queue(QUEUE.fulfilment, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 8,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 24 * 3600, count: 1_000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
  return fulfilmentQueue;
}

function getMaintenanceQueue(): Queue {
  maintenanceQueue ??= new Queue(QUEUE.maintenance, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "fixed", delay: 30_000 },
      removeOnComplete: { count: 50 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
  return maintenanceQueue;
}

export const queues = {
  fulfilment: getFulfilmentQueue,
  maintenance: getMaintenanceQueue,
};

/** Enqueue a settled-payment fulfilment. Deduped on the Stripe event id. */
export async function enqueueFulfilPayment(payload: FulfilPaymentPayload): Promise<void> {
  const data = fulfilPaymentPayload.parse(payload);
  await getFulfilmentQueue().add("fulfil-payment", data, {
    jobId: `stripe:${data.providerEventId}`,
  });
}
