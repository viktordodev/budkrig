import { env } from "@/server/config/env";
import { expirePendingBids } from "@/server/db/repositories/bids";
import { assertLedger, findUnsettledPaymentIntents } from "@/server/db/repositories/reconcile";
import { logger } from "@/server/observability/logger";
import { listRecentSucceededPaymentIntents } from "@/server/payments/reconcile";

/** Sweep abandoned checkouts (core-flows Flow 5). */
export async function processExpirePending(): Promise<void> {
  const ttlMinutes = env.PENDING_BID_TTL_MINUTES ?? 30;
  const cutoff = new Date(Date.now() - ttlMinutes * 60_000);
  const expired = await expirePendingBids(cutoff);
  if (expired > 0) logger.info({ expired }, "expire-pending swept abandoned claims");
}

/** Replay every listing's ledger and compare to the cached amount (invariant 2). */
export async function processAssertLedger(): Promise<void> {
  const mismatches = await assertLedger();
  if (mismatches.length > 0) {
    logger.error({ count: mismatches.length, mismatches }, "assert-ledger: MISMATCH");
    return;
  }
  logger.info("assert-ledger: clean");
}

/** Money taken at Stripe with no settled bid = a missed webhook. */
export async function processReconcileStripe(): Promise<void> {
  if (!env.STRIPE_SECRET_KEY) {
    logger.warn("reconcile-stripe: STRIPE_SECRET_KEY not set — skipping");
    return;
  }
  const succeeded = await listRecentSucceededPaymentIntents(72);
  const unsettled = await findUnsettledPaymentIntents(succeeded);
  if (unsettled.length > 0) {
    logger.error(
      { count: unsettled.length, paymentIntents: unsettled },
      "reconcile-stripe: succeeded payment_intents with no settled bid",
    );
    return;
  }
  logger.info({ checked: succeeded.length }, "reconcile-stripe: clean");
}
