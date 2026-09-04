import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { normalizeStripeEvent } from "./normalize";

const session = (over: Record<string, unknown> = {}): Stripe.Event =>
  ({
    id: "evt_123",
    type: "checkout.session.completed",
    data: {
      object: {
        object: "checkout.session",
        payment_status: "paid",
        payment_intent: "pi_abc",
        payment_method_types: ["card"],
        amount_total: 500_00,
        total_details: { amount_tax: 100_00 },
        customer_details: { address: { country: "SE" }, tax_ids: [] },
        metadata: { eventKey: "evt-key-1", bidId: "bid_1" },
        ...over,
      },
    },
  }) as unknown as Stripe.Event;

const pi = (over: Partial<Stripe.PaymentIntent> = {}): Stripe.Event =>
  ({
    id: "evt_456",
    type: "payment_intent.succeeded",
    data: {
      object: {
        object: "payment_intent",
        id: "pi_xyz",
        amount: 700_00,
        payment_method_types: ["swish"],
        metadata: { eventKey: "evt-key-2" },
        ...over,
      },
    },
  }) as unknown as Stripe.Event;

describe("normalizeStripeEvent", () => {
  it("maps a paid checkout session with 25% Swedish VAT", () => {
    expect(normalizeStripeEvent(session())).toEqual({
      provider: "stripe",
      providerEventId: "evt_123",
      providerPaymentIntent: "pi_abc",
      method: "card",
      eventKey: "evt-key-1",
      type: "checkout.session.completed",
      grossOre: 500_00,
      vatOre: 100_00,
      vatRate: "0.25",
      taxMode: "b2c_se",
      countryCode: "SE",
      payload: expect.objectContaining({ id: "evt_123" }),
    });
  });

  it("detects EU B2B reverse charge (valid VAT id, no tax charged)", () => {
    const ev = session({
      total_details: { amount_tax: 0 },
      customer_details: {
        address: { country: "DE" },
        tax_ids: [{ type: "eu_vat", value: "DE123456789" }],
      },
    });
    expect(normalizeStripeEvent(ev)).toMatchObject({
      taxMode: "b2b_eu_reverse_charge",
      vatOre: 0,
      vatRate: "0",
    });
  });

  it("handles the async settlement event the same way", () => {
    const ev = { ...session(), type: "checkout.session.async_payment_succeeded" } as Stripe.Event;
    expect(normalizeStripeEvent(ev)?.type).toBe("checkout.session.async_payment_succeeded");
  });

  it("returns null tax fields when Stripe Tax is off (no total_details)", () => {
    const ev = session({ total_details: undefined });
    expect(normalizeStripeEvent(ev)).toMatchObject({ vatOre: null, vatRate: null, taxMode: null });
  });

  it("ignores an unpaid session / a session missing our eventKey", () => {
    expect(normalizeStripeEvent(session({ payment_status: "unpaid" }))).toBeNull();
    expect(normalizeStripeEvent(session({ metadata: {} }))).toBeNull();
  });

  it("resolves an expanded payment_intent object", () => {
    const ev = session({ payment_intent: { id: "pi_expanded" } });
    expect(normalizeStripeEvent(ev)?.providerPaymentIntent).toBe("pi_expanded");
  });

  it("maps payment_intent.succeeded (no tax breakdown available)", () => {
    expect(normalizeStripeEvent(pi())).toMatchObject({
      providerEventId: "evt_456",
      providerPaymentIntent: "pi_xyz",
      method: "swish",
      eventKey: "evt-key-2",
      grossOre: 700_00,
      vatOre: null,
    });
  });

  it("ignores unrelated event types", () => {
    const ev = {
      id: "evt_9",
      type: "customer.created",
      data: { object: {} },
    } as unknown as Stripe.Event;
    expect(normalizeStripeEvent(ev)).toBeNull();
  });
});
