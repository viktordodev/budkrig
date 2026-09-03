import { ore, requiredMinimum } from "@/lib/money";
import type { ThresholdConfig } from "./threshold";
import type { BidState, ListingState, PaymentState } from "./types";

/**
 * Flow 1b (fulfilment, core-flows). Pure decision: given a settled-payment
 * event plus the rows the caller has loaded (with the listing locked FOR
 * UPDATE), decide what to write — or that this is a replay / an anomaly.
 *
 * The transaction glue (BEGIN, the SELECT ... FOR UPDATE, applying the writes,
 * COMMIT) lives in the server adapter and is covered by integration tests.
 * This function owns the tricky part: idempotency, state checks, and
 * recomputing amounts against the locked row (ADR-0004 / ADR-0005).
 */
export interface FulfilmentContext {
  /** True if this Stripe event id was already recorded + processed. */
  readonly webhookAlreadyProcessed: boolean;
  readonly providerPaymentIntent: string;
  readonly method: string;
  /** The bid found by our eventKey / Stripe metadata. */
  readonly bid: BidState | null;
  readonly payment: PaymentState | null;
  /** listing = bid.listingId, loaded FOR UPDATE. */
  readonly listing: ListingState | null;
  readonly config: ThresholdConfig;
  readonly now: Date;
}

export type FulfilmentDecision =
  | { readonly kind: "skip"; readonly reason: SkipReason }
  | { readonly kind: "anomaly"; readonly reason: AnomalyReason; readonly detail: string }
  | { readonly kind: "fulfil"; readonly writes: FulfilmentWrites };

export type SkipReason =
  /** Stripe re-delivered an event we already handled. */
  | "webhook_replayed"
  /** No bid for this event yet — reconcile-stripe / a bounded retry handles it. */
  | "bid_missing"
  /** This exact bid+PI is already settled — idempotent replay. */
  | "already_settled";

export type AnomalyReason =
  | "pi_conflict"
  | "bid_terminal"
  | "payment_missing"
  | "listing_missing"
  | "amount_mismatch";

export interface FulfilmentWrites {
  readonly bidId: string;
  readonly paymentId: string;
  readonly listingId: string;
  readonly providerPaymentIntent: string;
  readonly method: string;
  readonly settledAt: Date;
  /** Final ledger amounts, recomputed against the locked listing. */
  readonly bid: { readonly previousAmountOre: number; readonly resultingAmountOre: number };
  readonly listing: {
    readonly status: "active" | "hidden" | "removed";
    readonly currentAmountOre: number;
    readonly firstActiveAt: Date;
    readonly lastBidAt: Date;
  };
  /** Non-fatal note for the operator queue, if anything looked off. */
  readonly flag?: string;
}

export function decideFulfilment(ctx: FulfilmentContext): FulfilmentDecision {
  if (ctx.webhookAlreadyProcessed) {
    return { kind: "skip", reason: "webhook_replayed" };
  }
  if (!ctx.bid) {
    return { kind: "skip", reason: "bid_missing" };
  }

  if (ctx.bid.status === "settled") {
    return ctx.bid.providerPaymentIntent === ctx.providerPaymentIntent
      ? { kind: "skip", reason: "already_settled" }
      : {
          kind: "anomaly",
          reason: "pi_conflict",
          detail: `bid ${ctx.bid.id} already settled with a different payment_intent`,
        };
  }
  if (ctx.bid.status !== "pending") {
    return {
      kind: "anomaly",
      reason: "bid_terminal",
      detail: `bid ${ctx.bid.id} is ${ctx.bid.status}`,
    };
  }

  if (!ctx.payment) {
    return {
      kind: "anomaly",
      reason: "payment_missing",
      detail: `no payment row for bid ${ctx.bid.id}`,
    };
  }
  if (!ctx.listing) {
    return {
      kind: "anomaly",
      reason: "listing_missing",
      detail: `listing ${ctx.bid.listingId} not found`,
    };
  }
  if (ctx.payment.amountOre !== ctx.bid.deltaOre) {
    return {
      kind: "anomaly",
      reason: "amount_mismatch",
      detail: `payment ${ctx.payment.amountOre} != bid delta ${ctx.bid.deltaOre}`,
    };
  }

  // Recompute against the LOCKED current amount: the pending bid's provisional
  // previous/resulting are stale if the listing moved since the claim (ADR-0005).
  // `delta` is fixed — that's what Stripe charged.
  const previousAmountOre = ctx.listing.currentAmountOre;
  const resultingAmountOre = previousAmountOre + ctx.bid.deltaOre;

  const required = requiredMinimum({
    previousAmount: ore(previousAmountOre),
    newListingMin: ctx.config.newListingMinOre,
    minIncrement: ctx.config.minIncrementOre,
  });
  const flag =
    resultingAmountOre < required
      ? `resulting ${resultingAmountOre} below required ${required} at fulfilment — fulfilling anyway per ADR-0005`
      : undefined;

  const status: "active" | "hidden" | "removed" =
    ctx.listing.status === "hidden"
      ? "hidden"
      : ctx.listing.status === "removed"
        ? "removed"
        : "active";

  return {
    kind: "fulfil",
    writes: {
      bidId: ctx.bid.id,
      paymentId: ctx.payment.id,
      listingId: ctx.listing.id,
      providerPaymentIntent: ctx.providerPaymentIntent,
      method: ctx.method,
      settledAt: ctx.now,
      bid: { previousAmountOre, resultingAmountOre },
      listing: {
        status,
        currentAmountOre: resultingAmountOre,
        firstActiveAt: ctx.listing.firstActiveAt ?? ctx.now,
        lastBidAt: ctx.now,
      },
      ...(flag ? { flag } : {}),
    },
  };
}
