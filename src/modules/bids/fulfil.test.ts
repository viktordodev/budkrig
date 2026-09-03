import { ore } from "@/lib/money";
import { describe, expect, it } from "vitest";
import { type FulfilmentContext, decideFulfilment } from "./fulfil";
import type { BidState, ListingState, PaymentState } from "./types";

const NOW = new Date("2026-09-03T12:00:00.000Z");
const config = { newListingMinOre: ore(500), minIncrementOre: ore(100) };

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

const ctx = (over: Partial<FulfilmentContext> = {}): FulfilmentContext => ({
  webhookAlreadyProcessed: false,
  providerPaymentIntent: "pi_123",
  method: "card",
  bid: bid(),
  payment: payment(),
  listing: listing(),
  config,
  now: NOW,
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

  it("skips an already-settled bid with the same payment_intent (idempotent replay)", () => {
    const d = decideFulfilment(
      ctx({ bid: bid({ status: "settled", providerPaymentIntent: "pi_123" }) }),
    );
    expect(d).toEqual({ kind: "skip", reason: "already_settled" });
  });

  it("flags a settled bid carrying a different payment_intent", () => {
    const d = decideFulfilment(
      ctx({ bid: bid({ status: "settled", providerPaymentIntent: "pi_OLD" }) }),
    );
    expect(d).toMatchObject({ kind: "anomaly", reason: "pi_conflict" });
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

describe("decideFulfilment — fulfils", () => {
  it("activates a brand-new listing and stamps first_active_at", () => {
    const d = decideFulfilment(ctx());
    expect(d).toEqual({
      kind: "fulfil",
      writes: {
        bidId: "bid_1",
        paymentId: "pay_1",
        listingId: "lst_1",
        providerPaymentIntent: "pi_123",
        method: "card",
        settledAt: NOW,
        bid: { previousAmountOre: 0, resultingAmountOre: 500 },
        listing: {
          status: "active",
          currentAmountOre: 500,
          firstActiveAt: NOW,
          lastBidAt: NOW,
        },
      },
    });
  });

  it("raises an active listing and keeps the original first_active_at", () => {
    const firstActiveAt = new Date("2026-08-01T00:00:00.000Z");
    const d = decideFulfilment(
      ctx({
        bid: bid({ deltaOre: 3_000 }),
        payment: payment({ amountOre: 3_000 }),
        listing: listing({ status: "active", currentAmountOre: 12_000, firstActiveAt }),
      }),
    );
    expect(d).toMatchObject({
      kind: "fulfil",
      writes: {
        bid: { previousAmountOre: 12_000, resultingAmountOre: 15_000 },
        listing: { currentAmountOre: 15_000, firstActiveAt, status: "active" },
      },
    });
  });

  it("recomputes against the locked amount when the board moved since the claim", () => {
    // claimed when the listing was at 800 (delta 200); by settlement it's at 2000
    const d = decideFulfilment(
      ctx({
        bid: bid({ deltaOre: 200 }),
        payment: payment({ amountOre: 200 }),
        listing: listing({ status: "active", currentAmountOre: 2_000, firstActiveAt: NOW }),
      }),
    );
    expect(d).toMatchObject({
      kind: "fulfil",
      writes: { bid: { previousAmountOre: 2_000, resultingAmountOre: 2_200 } },
    });
  });

  it("records the bid + payment but does not un-hide a hidden/removed listing", () => {
    for (const status of ["hidden", "removed"] as const) {
      const d = decideFulfilment(
        ctx({ listing: listing({ status, currentAmountOre: 5_000, firstActiveAt: NOW }) }),
      );
      expect(d).toMatchObject({
        kind: "fulfil",
        writes: { listing: { status, currentAmountOre: 5_500 } },
      });
    }
  });

  it("still fulfils but flags when the resulting amount is below the required minimum", () => {
    // contrived: delta smaller than the increment (a config change / bug)
    const d = decideFulfilment(
      ctx({
        bid: bid({ deltaOre: 50 }),
        payment: payment({ amountOre: 50 }),
        listing: listing({ status: "active", currentAmountOre: 1_000, firstActiveAt: NOW }),
      }),
    );
    expect(d.kind).toBe("fulfil");
    if (d.kind === "fulfil") {
      expect(d.writes.bid.resultingAmountOre).toBe(1_050);
      expect(d.writes.flag).toMatch(/below required/);
    }
  });
});
