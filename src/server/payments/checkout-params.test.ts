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
  taxEnabled: false,
  paymentMethods: ["swish", "card", "klarna"],
};

describe("buildCheckoutSessionParams", () => {
  it("charges the exact öre amount as a one-time SEK payment", () => {
    const p = buildCheckoutSessionParams(base);
    expect(p.mode).toBe("payment");
    expect(p.line_items?.[0]?.price_data?.currency).toBe("sek");
    expect(p.line_items?.[0]?.price_data?.unit_amount).toBe(17_005_00);
    expect(p.line_items?.[0]?.quantity).toBe(1);
  });

  it("passes the configured methods through in order (Swish before credit)", () => {
    expect(buildCheckoutSessionParams(base).payment_method_types).toEqual([
      "swish",
      "card",
      "klarna",
    ]);
    expect(
      buildCheckoutSessionParams({ ...base, paymentMethods: ["card"] }).payment_method_types,
    ).toEqual(["card"]);
  });

  it("threads eventKey + bidId through session AND payment_intent metadata", () => {
    const p = buildCheckoutSessionParams(base);
    expect(p.metadata).toMatchObject({ bidId: "bid_1", eventKey: "evt-key-1" });
    expect(p.payment_intent_data?.metadata).toEqual({ bidId: "bid_1", eventKey: "evt-key-1" });
  });

  it("omits all tax config when taxEnabled is false", () => {
    const p = buildCheckoutSessionParams(base);
    expect(p.automatic_tax).toBeUndefined();
    expect(p.tax_id_collection).toBeUndefined();
    expect(p.billing_address_collection).toBeUndefined();
    expect(p.line_items?.[0]?.price_data?.tax_behavior).toBeUndefined();
  });

  it("enables automatic tax + VAT-inclusive pricing + VAT-id collection when taxEnabled", () => {
    const p = buildCheckoutSessionParams({ ...base, taxEnabled: true });
    expect(p.automatic_tax).toEqual({ enabled: true });
    expect(p.tax_id_collection).toEqual({ enabled: true });
    expect(p.billing_address_collection).toBe("required");
    expect(p.line_items?.[0]?.price_data?.tax_behavior).toBe("inclusive");
  });

  it("labels a raise differently from a new listing", () => {
    const claim = buildCheckoutSessionParams({ ...base, isNewListing: true });
    const raise = buildCheckoutSessionParams({ ...base, isNewListing: false });
    expect(claim.line_items?.[0]?.price_data?.product_data?.name).toMatch(/placering/);
    expect(raise.line_items?.[0]?.price_data?.product_data?.name).toMatch(/höjning/);
  });
});
