import type { FulfilmentDecision } from "@/modules/bids/fulfil";
import { decideFulfilment } from "@/modules/bids/fulfil";
import type { Clock, FulfilmentRepository, SettledPaymentEvent } from "@/modules/bids/ports";
import type { ThresholdConfig } from "@/modules/bids/threshold";
import type { BidState, ListingState, PaymentState } from "@/modules/bids/types";
import { logger } from "@/server/observability/logger";
import { and, eq, ne, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema";

type Db = PostgresJsDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/**
 * The fulfilment transaction (core-flows Flow 1b). One DB transaction:
 * record the webhook event, load bid/payment/listing (listing FOR UPDATE),
 * run the pure `decideFulfilment`, apply the writes. Idempotent on the Stripe
 * event id and on bid + payment_intent.
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
        // Backstop: the bids_settled_pi_uq / payments_pi_uq partial indexes.
        if (isUniqueViolation(err)) {
          logger.warn(
            { providerEventId: event.providerEventId, err: messageOf(err) },
            "fulfil: payment_intent unique violation — treating as pi_conflict",
          );
          return {
            kind: "anomaly",
            reason: "pi_conflict",
            detail: `unique violation settling payment_intent ${event.providerPaymentIntent}`,
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

  // 2–4. Load the rows the decision needs.
  const [bidRow] = await tx
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.eventKey, event.eventKey));

  const paymentRow = bidRow
    ? (await tx.select().from(schema.payments).where(eq(schema.payments.bidId, bidRow.id)))[0]
    : undefined;

  let listingRow: ListingRow | undefined;
  if (bidRow) {
    // Serialise ALL fulfilment for this listing before we read its current
    // amount — a transaction-scoped advisory lock (releases on commit/rollback)
    // plus the row lock. Without this, two concurrent settlements both read the
    // stale amount and one overwrites the other (lost update).
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${bidRow.listingId}::text, 0))`,
    );
    listingRow = (
      await tx
        .select()
        .from(schema.listings)
        .where(eq(schema.listings.id, bidRow.listingId))
        .for("update")
    )[0];
  }

  // 5. Decide.
  const decision = decideFulfilment({
    webhookAlreadyProcessed,
    providerPaymentIntent: event.providerPaymentIntent,
    method: event.method,
    bid: bidRow ? toBidState(bidRow) : null,
    payment: paymentRow ? toPaymentState(paymentRow) : null,
    listing: listingRow ? toListingState(listingRow) : null,
    config,
    now,
  });

  // 6. Apply.
  if (decision.kind === "fulfil") {
    const w = decision.writes;

    const [piConflict] = await tx
      .select({ id: schema.bids.id })
      .from(schema.bids)
      .where(
        and(
          eq(schema.bids.providerPaymentIntent, event.providerPaymentIntent),
          eq(schema.bids.status, "settled"),
          ne(schema.bids.id, w.bidId),
        ),
      );
    if (piConflict) {
      const detail = `payment_intent ${event.providerPaymentIntent} already settled on bid ${piConflict.id}`;
      await markProcessed(tx, event, now, detail);
      return { kind: "anomaly", reason: "pi_conflict", detail };
    }

    await tx
      .update(schema.bids)
      .set({
        previousAmountOre: w.bid.previousAmountOre,
        resultingAmountOre: w.bid.resultingAmountOre,
        status: "settled",
        settledAt: w.settledAt,
        providerPaymentIntent: w.providerPaymentIntent,
      })
      .where(eq(schema.bids.id, w.bidId));

    await tx
      .update(schema.payments)
      .set({
        status: "settled",
        method: w.method,
        settledAt: w.settledAt,
        providerPaymentIntent: w.providerPaymentIntent,
        rawEvent: event.payload ?? {},
      })
      .where(eq(schema.payments.id, w.paymentId));

    await tx
      .update(schema.listings)
      .set({
        currentAmountOre: w.listing.currentAmountOre,
        status: w.listing.status,
        firstActiveAt: w.listing.firstActiveAt,
        lastBidAt: w.listing.lastBidAt,
        updatedAt: now,
      })
      .where(eq(schema.listings.id, w.listingId));

    if (w.flag) {
      await tx.insert(schema.moderationActions).values({
        listingId: w.listingId,
        actor: "system",
        action: "flag",
        reason: w.flag,
      });
    }
  }

  // 7. Mark the webhook event processed for terminal outcomes. `bid_missing`
  // deliberately stays unprocessed so reconcile-stripe / a retry picks it up.
  const terminal =
    decision.kind === "fulfil" ||
    decision.kind === "anomaly" ||
    (decision.kind === "skip" &&
      (decision.reason === "already_settled" || decision.reason === "webhook_replayed"));

  if (terminal) {
    await markProcessed(tx, event, now, decision.kind === "anomaly" ? decision.detail : null);
  }

  return decision;
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
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
