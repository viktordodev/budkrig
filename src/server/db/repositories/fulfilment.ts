import { ore } from "@/lib/money";
import type { FulfilmentDecision, FulfilmentPlan } from "@/modules/bids/fulfil";
import { decideFulfilment } from "@/modules/bids/fulfil";
import type { Clock, FulfilmentRepository, SettledPaymentEvent } from "@/modules/bids/ports";
import { type ThresholdConfig, checkAmount } from "@/modules/bids/threshold";
import type { BidState, ListingState, PaymentState } from "@/modules/bids/types";
import { logger } from "@/server/observability/logger";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema";

type Db = PostgresJsDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * The fulfilment transaction (core-flows Flow 1b). One DB transaction:
 * record the webhook event (idempotency), load bid/payment/listing, run the
 * pure `decideFulfilment` state machine, then apply the ledger write:
 *
 *  1. claim the pending bid by stamping provider_payment_intent
 *     (WHERE status='pending' AND provider_payment_intent IS NULL) — the row
 *     lock + predicate is the mutex; a repeat delivery gets 0 rows
 *  2. atomically bump the listing: SET current_amount_ore = current_amount_ore
 *     + delta ... RETURNING — Postgres reads the latest committed value when it
 *     takes the row lock, so concurrent settlements chain with no read race
 *  3. flip the bid to settled WITH previous/resulting from the RETURNING value
 *
 * Idempotent on the Stripe event id and on bid + payment_intent (the
 * bids_settled_pi_uq partial index, surfaced as a pi_conflict anomaly).
 */
export function createFulfilmentRepository(
  db: Db,
  config: ThresholdConfig,
  clock: Clock,
): FulfilmentRepository {
  return {
    async fulfil(event) {
      try {
        return await db.transaction((tx) => runFulfilment(tx, event, config, clock));
      } catch (err) {
        if (isUniqueViolation(err)) {
          logger.warn(
            { providerEventId: event.providerEventId, err: messageOf(err) },
            "fulfil: payment_intent unique violation — treating as pi_conflict",
          );
          return {
            kind: "anomaly",
            reason: "pi_conflict",
            detail: `payment_intent ${event.providerPaymentIntent} is already settled on another bid`,
          };
        }
        throw err;
      }
    },
  };
}

async function runFulfilment(
  tx: Tx,
  event: SettledPaymentEvent,
  config: ThresholdConfig,
  clock: Clock,
): Promise<FulfilmentDecision> {
  const now = clock.now();

  // 1. Webhook-event idempotency.
  const inserted = await tx
    .insert(schema.webhookEvents)
    .values({
      provider: event.provider,
      providerEventId: event.providerEventId,
      type: event.type,
      payload: event.payload ?? {},
    })
    .onConflictDoNothing({
      target: [schema.webhookEvents.provider, schema.webhookEvents.providerEventId],
    })
    .returning({ id: schema.webhookEvents.id });

  let webhookAlreadyProcessed = false;
  if (inserted.length === 0) {
    const [existing] = await tx
      .select({ processedAt: schema.webhookEvents.processedAt })
      .from(schema.webhookEvents)
      .where(eventPredicate(event));
    webhookAlreadyProcessed = existing?.processedAt != null;
  }

  // 2. Load the rows the decision needs (plain reads — existence + state).
  const [bidRow] = await tx
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.eventKey, event.eventKey));
  const paymentRow = bidRow
    ? (await tx.select().from(schema.payments).where(eq(schema.payments.bidId, bidRow.id)))[0]
    : undefined;
  const listingRow = bidRow
    ? (await tx.select().from(schema.listings).where(eq(schema.listings.id, bidRow.listingId)))[0]
    : undefined;

  // 3. Decide (state machine only — no arithmetic).
  const decision = decideFulfilment({
    webhookAlreadyProcessed,
    providerPaymentIntent: event.providerPaymentIntent,
    method: event.method,
    tax: {
      grossOre: event.grossOre,
      vatOre: event.vatOre,
      vatRate: event.vatRate,
      taxMode: event.taxMode,
      countryCode: event.countryCode,
    },
    bid: bidRow ? toBidState(bidRow) : null,
    payment: paymentRow ? toPaymentState(paymentRow) : null,
    listing: listingRow ? toListingState(listingRow) : null,
  });

  const outcome =
    decision.kind === "proceed"
      ? await applyFulfilment(tx, decision.plan, config, now, event)
      : decision;

  // 4. Mark the webhook event processed for terminal outcomes. `bid_missing`
  // stays unprocessed so reconcile-stripe / a retry picks it up.
  if (isTerminal(outcome)) {
    await markProcessed(tx, event, now, outcome.kind === "anomaly" ? outcome.detail : null);
  }
  return outcome;
}

async function applyFulfilment(
  tx: Tx,
  plan: FulfilmentPlan,
  config: ThresholdConfig,
  now: Date,
  event: SettledPaymentEvent,
): Promise<FulfilmentDecision> {
  // Claim the bid by stamping the payment_intent while it's still `pending`
  // (status can't flip to `settled` before the amounts are known — the
  // bids_settled_has_amounts CHECK). A concurrent / repeat delivery finds
  // provider_payment_intent already set and gets 0 rows.
  const claimed = await tx
    .update(schema.bids)
    .set({ providerPaymentIntent: plan.providerPaymentIntent })
    .where(
      and(
        eq(schema.bids.id, plan.bidId),
        eq(schema.bids.status, "pending"),
        isNull(schema.bids.providerPaymentIntent),
      ),
    )
    .returning({ id: schema.bids.id });

  if (claimed.length === 0) {
    return { kind: "skip", reason: "already_settled" };
  }

  // Atomic increment against the latest committed amount. The row lock this
  // takes is held until commit, so the follow-up status write is race-free.
  const [listing] = await tx
    .update(schema.listings)
    .set({
      currentAmountOre: sql`${schema.listings.currentAmountOre} + ${plan.deltaOre}`,
      // set-once: keep an existing first_active_at, else stamp now (ISO string —
      // a bare Date isn't serialisable inside a raw sql fragment)
      firstActiveAt: sql`coalesce(${schema.listings.firstActiveAt}, ${now.toISOString()}::timestamptz)`,
      lastBidAt: now,
      updatedAt: now,
    })
    .where(eq(schema.listings.id, plan.listingId))
    .returning({
      currentAmountOre: schema.listings.currentAmountOre,
      status: schema.listings.status,
    });

  if (!listing) {
    throw new Error(`fulfil: listing ${plan.listingId} vanished mid-transaction`);
  }

  // Go active — but never un-hide / un-remove a moderated listing.
  if (listing.status !== "active" && listing.status !== "hidden" && listing.status !== "removed") {
    await tx
      .update(schema.listings)
      .set({ status: "active" })
      .where(eq(schema.listings.id, plan.listingId));
  }

  const resultingAmountOre = listing.currentAmountOre;
  const previousAmountOre = resultingAmountOre - plan.deltaOre;

  // Now the bid becomes part of the settled ledger — status + amounts together.
  await tx
    .update(schema.bids)
    .set({ status: "settled", settledAt: now, previousAmountOre, resultingAmountOre })
    .where(eq(schema.bids.id, plan.bidId));

  await tx
    .update(schema.payments)
    .set({
      status: "settled",
      method: plan.method,
      settledAt: now,
      providerPaymentIntent: plan.providerPaymentIntent,
      vatRate: plan.tax.vatRate,
      vatAmountOre: plan.tax.vatOre,
      taxMode: plan.tax.taxMode,
      rawEvent: event.payload ?? {},
    })
    .where(eq(schema.payments.id, plan.paymentId));

  // ADR-0005: we never withhold a paid rank. If the resulting amount somehow
  // lands below the current floor (a config change), fulfil anyway and flag.
  const required = checkAmount({
    previousAmountOre: ore(previousAmountOre),
    targetAmountOre: ore(resultingAmountOre),
    config,
  });
  if (!required.ok) {
    await tx.insert(schema.moderationActions).values({
      listingId: plan.listingId,
      actor: "system",
      action: "flag",
      reason: `resulting ${resultingAmountOre} below required ${required.error.requiredOre} at fulfilment`,
    });
  }

  return { kind: "proceed", plan };
}

function isTerminal(d: FulfilmentDecision): boolean {
  return (
    d.kind === "proceed" ||
    d.kind === "anomaly" ||
    (d.kind === "skip" && (d.reason === "already_settled" || d.reason === "webhook_replayed"))
  );
}

function eventPredicate(event: SettledPaymentEvent) {
  return and(
    eq(schema.webhookEvents.provider, event.provider),
    eq(schema.webhookEvents.providerEventId, event.providerEventId),
  );
}

async function markProcessed(
  tx: Tx,
  event: SettledPaymentEvent,
  now: Date,
  error: string | null,
): Promise<void> {
  await tx
    .update(schema.webhookEvents)
    .set({ processedAt: now, error })
    .where(eventPredicate(event));
}

type BidRow = typeof schema.bids.$inferSelect;
type PaymentRow = typeof schema.payments.$inferSelect;
type ListingRow = typeof schema.listings.$inferSelect;

function toBidState(row: BidRow): BidState {
  return {
    id: row.id,
    listingId: row.listingId,
    deltaOre: row.deltaOre,
    status: row.status,
    eventKey: row.eventKey,
    providerPaymentIntent: row.providerPaymentIntent,
  };
}

function toPaymentState(row: PaymentRow): PaymentState {
  return { id: row.id, bidId: row.bidId, status: row.status, amountOre: row.amountOre };
}

function toListingState(row: ListingRow): ListingState {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    currentAmountOre: row.currentAmountOre,
    firstActiveAt: row.firstActiveAt,
  };
}

function isUniqueViolation(err: unknown): boolean {
  // drizzle wraps the driver error; the PostgresError with `.code` is on `.cause`
  // (possibly nested).
  for (let e: unknown = err, depth = 0; e && depth < 5; depth++) {
    if (typeof e === "object" && "code" in e && (e as { code?: unknown }).code === "23505") {
      return true;
    }
    e =
      typeof e === "object" && e !== null && "cause" in e ? (e as { cause?: unknown }).cause : null;
  }
  return false;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
