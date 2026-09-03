import { describe, expect, it } from "vitest";
import { type CheckoutInput, buildCheckoutSessionParams } from "./checkout-params";

const base: CheckoutInput = {
  bidId: "bid_1",
  eventKey: "evt-key-1",
  listingSlug: "exempel.se",
  amountOre: 17_005_00,
  isNewListing: true,
  customerEmail: "buyer@example.com",
  locale: "sv",
  successUrl: "https://budkrig.se/klar?s={CHECKOUT_SESSION_ID}",
  cancelUrl: "https://budkrig.se/avbrutet",
};

describe("buildCheckoutSessionParams", () => {
  it("charges the exact öre amount as a one-time SEK payment", () => {
    const p = buildCheckoutSessionParams(base);
    expect(p.mode).toBe("payment");
    expect(p.currency ?? p.line_items?.[0]?.price_data?.currency).toBe("sek");
    expect(p.line_items?.[0]?.price_data?.unit_amount).toBe(17_005_00);
    expect(p.line_items?.[0]?.quantity).toBe(1);
  });

  it("threads eventKey + bidId through session AND payment_intent metadata", () => {
    const p = buildCheckoutSessionParams(base);
    expect(p.metadata).toMatchObject({ bidId: "bid_1", eventKey: "evt-key-1" });
    expect(p.payment_intent_data?.metadata).toEqual({ bidId: "bid_1", eventKey: "evt-key-1" });
  });

  it("uses the buyer's locale and email, and the success/cancel URLs", () => {
    const p = buildCheckoutSessionParams({ ...base, locale: "en" });
    expect(p.locale).toBe("en");
    expect(p.customer_email).toBe("buyer@example.com");
    expect(p.success_url).toContain("{CHECKOUT_SESSION_ID}");
    expect(p.cancel_url).toBe("https://budkrig.se/avbrutet");
  });

  it("labels a raise differently from a new listing", () => {
    const claim = buildCheckoutSessionParams({ ...base, isNewListing: true });
    const raise = buildCheckoutSessionParams({ ...base, isNewListing: false });
    expect(claim.line_items?.[0]?.price_data?.product_data?.name).toMatch(/placering/);
    expect(raise.line_items?.[0]?.price_data?.product_data?.name).toMatch(/höjning/);
  });
});
