import { type SettledPaymentEvent, systemClock } from "@/modules/bids/ports";
import { biddingConfig } from "@/server/config/bidding";
import { db as defaultDb } from "@/server/db/client";
import { createFulfilmentRepository } from "@/server/db/repositories/fulfilment";
import type * as schema from "@/server/db/schema";
import { logger } from "@/server/observability/logger";
import type { FulfilPaymentPayload } from "@/server/queue/jobs";
import { CACHE_KEYS, invalidateCache } from "@/server/redis/cache";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

/**
 * Processes one `fulfil-payment` job (core-flows Flow 1b). `repo.fulfil` is
 * idempotent, so a retried job is safe.
 *  - `proceed`  → invalidate the board cache
 *  - `bid_missing` → THROW so BullMQ retries (the pending bid may still be
 *    committing); reconcile-stripe is the backstop after retries exhaust
 *  - `anomaly`  → log for the operator, don't retry (data problem, not transient)
 */
export async function processFulfilPayment(
  payload: FulfilPaymentPayload,
  db: PostgresJsDatabase<typeof schema> = defaultDb,
): Promise<void> {
  const event: SettledPaymentEvent = {
    provider: payload.provider,
    providerEventId: payload.providerEventId,
    providerPaymentIntent: payload.providerPaymentIntent,
    method: payload.method,
    eventKey: payload.eventKey,
    type: payload.type,
    payload: payload.payload,
  };

  const repo = createFulfilmentRepository(db, biddingConfig, systemClock);
  const decision = await repo.fulfil(event);

  if (decision.kind === "proceed") {
    await invalidateCache(CACHE_KEYS.board("all"));
  }

  if (decision.kind === "skip" && decision.reason === "bid_missing") {
    throw new Error(`fulfil-payment: no bid for eventKey yet (${event.providerEventId})`);
  }

  if (decision.kind === "anomaly") {
    logger.error(
      { providerEventId: event.providerEventId, reason: decision.reason, detail: decision.detail },
      "fulfil-payment: anomaly",
    );
    return;
  }

  logger.info(
    { providerEventId: event.providerEventId, decision: decision.kind },
    "fulfil-payment processed",
  );
}
