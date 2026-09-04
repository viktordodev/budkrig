import { describe, expect, it } from "vitest";
import { type FulfilmentContext, decideFulfilment } from "./fulfil";
import type { BidState, ListingState, PaymentState } from "./types";

const bid = (over: Partial<BidState> = {}): BidState => ({
  id: "bid_1",
  listingId: "lst_1",
  deltaOre: 500,
  status: "pending",
  eventKey: "evt_key_1",
  providerPaymentIntent: null,
  ...over,
});

const payment = (over: Partial<PaymentState> = {}): PaymentState => ({
  id: "pay_1",
  bidId: "bid_1",
  status: "pending",
  amountOre: 500,
  ...over,
});

const listing = (over: Partial<ListingState> = {}): ListingState => ({
  id: "lst_1",
  slug: "exempel.se",
  status: "pending_payment",
  currentAmountOre: 0,
  firstActiveAt: null,
  ...over,
});

const tax = (over: Partial<FulfilmentContext["tax"]> = {}): FulfilmentContext["tax"] => ({
  grossOre: 500,
  vatOre: null,
  vatRate: null,
  taxMode: null,
  countryCode: null,
  ...over,
});

const ctx = (over: Partial<FulfilmentContext> = {}): FulfilmentContext => ({
  webhookAlreadyProcessed: false,
  providerPaymentIntent: "pi_123",
  method: "card",
  tax: tax(),
  bid: bid(),
  payment: payment(),
  listing: listing(),
  ...over,
});

describe("decideFulfilment — skips & anomalies", () => {
  it("skips a replayed webhook event", () => {
    expect(decideFulfilment(ctx({ webhookAlreadyProcessed: true }))).toEqual({
      kind: "skip",
      reason: "webhook_replayed",
    });
  });

  it("skips when the bid isn't there yet (reconcile will retry)", () => {
    expect(decideFulfilment(ctx({ bid: null }))).toEqual({ kind: "skip", reason: "bid_missing" });
  });

  it("skips an already-settled bid with the same payment_intent", () => {
    expect(
      decideFulfilment(ctx({ bid: bid({ status: "settled", providerPaymentIntent: "pi_123" }) })),
    ).toEqual({ kind: "skip", reason: "already_settled" });
  });

  it("flags a settled bid carrying a different payment_intent", () => {
    expect(
      decideFulfilment(ctx({ bid: bid({ status: "settled", providerPaymentIntent: "pi_OLD" }) })),
    ).toMatchObject({ kind: "anomaly", reason: "pi_conflict" });
  });

  it("flags a bid in a terminal state", () => {
    for (const status of ["expired", "refunded"] as const) {
      expect(decideFulfilment(ctx({ bid: bid({ status }) }))).toMatchObject({
        kind: "anomaly",
        reason: "bid_terminal",
      });
    }
  });

  it("flags a missing payment / listing", () => {
    expect(decideFulfilment(ctx({ payment: null }))).toMatchObject({
      kind: "anomaly",
      reason: "payment_missing",
    });
    expect(decideFulfilment(ctx({ listing: null }))).toMatchObject({
      kind: "anomaly",
      reason: "listing_missing",
    });
  });

  it("flags a payment whose amount != the bid delta", () => {
    expect(decideFulfilment(ctx({ payment: payment({ amountOre: 499 }) }))).toMatchObject({
      kind: "anomaly",
      reason: "amount_mismatch",
    });
  });
});

describe("decideFulfilment — proceed", () => {
  it("returns a plan carrying the ids, delta and payment details", () => {
    expect(decideFulfilment(ctx())).toEqual({
      kind: "proceed",
      plan: {
        bidId: "bid_1",
        paymentId: "pay_1",
        listingId: "lst_1",
        deltaOre: 500,
        providerPaymentIntent: "pi_123",
        method: "card",
        tax: { grossOre: 500, vatOre: null, vatRate: null, taxMode: null, countryCode: null },
      },
    });
  });

  it("flags a settled amount that differs from the bid delta", () => {
    expect(decideFulfilment(ctx({ tax: tax({ grossOre: 501 }) }))).toMatchObject({
      kind: "anomaly",
      reason: "amount_mismatch",
    });
  });

  it("proceeds regardless of the listing's current amount / status (the adapter does the arithmetic)", () => {
    for (const status of ["pending_payment", "active", "hidden", "removed"] as const) {
      const d = decideFulfilment(
        ctx({ listing: listing({ status, currentAmountOre: 99_999, firstActiveAt: new Date() }) }),
      );
      expect(d.kind).toBe("proceed");
    }
  });
});
