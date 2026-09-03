import type { BidState, ListingState, PaymentMethod, PaymentState } from "./types";

/**
 * Flow 1b (fulfilment, core-flows). Pure decision: given a settled-payment
 * event plus the rows the caller loaded, decide whether to proceed, skip
 * (replay), or flag an anomaly.
 *
 * It deliberately does NOT compute amounts. The adapter applies the ledger
 * write as an atomic `UPDATE listings SET current_amount_ore = current_amount_ore
 * + delta … RETURNING` (ADR-0004 / ADR-0005) — the only race-free way to chain
 * concurrent settlements on one listing. `decideFulfilment` owns the state
 * machine; the adapter owns the arithmetic.
 */
export interface FulfilmentContext {
  /** True if this Stripe event id was already recorded + processed. */
  readonly webhookAlreadyProcessed: boolean;
  readonly providerPaymentIntent: string;
  readonly method: PaymentMethod;
  /** The bid found by our eventKey / Stripe metadata. */
  readonly bid: BidState | null;
  readonly payment: PaymentState | null;
  /** listing = bid.listingId (a plain read — existence check only). */
  readonly listing: ListingState | null;
}

export type FulfilmentDecision =
  | { readonly kind: "skip"; readonly reason: SkipReason }
  | { readonly kind: "anomaly"; readonly reason: AnomalyReason; readonly detail: string }
  | { readonly kind: "proceed"; readonly plan: FulfilmentPlan };

export type SkipReason =
  /** Stripe re-delivered an event we already handled. */
  | "webhook_replayed"
  /** No bid for this event yet — reconcile-stripe / a bounded retry handles it. */
  | "bid_missing"
  /** This exact bid + payment_intent is already settled — idempotent replay. */
  | "already_settled";

export type AnomalyReason =
  | "pi_conflict"
  | "bid_terminal"
  | "payment_missing"
  | "listing_missing"
  | "amount_mismatch";

export interface FulfilmentPlan {
  readonly bidId: string;
  readonly paymentId: string;
  readonly listingId: string;
  readonly deltaOre: number;
  readonly providerPaymentIntent: string;
  readonly method: PaymentMethod;
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

  return {
    kind: "proceed",
    plan: {
      bidId: ctx.bid.id,
      paymentId: ctx.payment.id,
      listingId: ctx.listing.id,
      deltaOre: ctx.bid.deltaOre,
      providerPaymentIntent: ctx.providerPaymentIntent,
      method: ctx.method,
    },
  };
}
