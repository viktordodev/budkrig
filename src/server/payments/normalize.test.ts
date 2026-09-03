import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { normalizeStripeEvent } from "./normalize";

const checkoutCompleted = (over: Partial<Stripe.Checkout.Session> = {}): Stripe.Event =>
  ({
    id: "evt_123",
    type: "checkout.session.completed",
    data: {
      object: {
        object: "checkout.session",
        payment_status: "paid",
        payment_intent: "pi_abc",
        payment_method_types: ["card"],
        metadata: { eventKey: "evt-key-1", bidId: "bid_1" },
        ...over,
      },
    },
  }) as unknown as Stripe.Event;

const piSucceeded = (over: Partial<Stripe.PaymentIntent> = {}): Stripe.Event =>
  ({
    id: "evt_456",
    type: "payment_intent.succeeded",
    data: {
      object: {
        object: "payment_intent",
        id: "pi_xyz",
        payment_method_types: ["swish"],
        metadata: { eventKey: "evt-key-2" },
        ...over,
      },
    },
  }) as unknown as Stripe.Event;

describe("normalizeStripeEvent", () => {
  it("maps a paid checkout.session.completed to a SettledPaymentEvent", () => {
    expect(normalizeStripeEvent(checkoutCompleted())).toEqual({
      provider: "stripe",
      providerEventId: "evt_123",
      providerPaymentIntent: "pi_abc",
      method: "card",
      eventKey: "evt-key-1",
      type: "checkout.session.completed",
      payload: expect.objectContaining({ id: "evt_123" }),
    });
  });

  it("ignores an unpaid checkout session", () => {
    expect(normalizeStripeEvent(checkoutCompleted({ payment_status: "unpaid" }))).toBeNull();
  });

  it("ignores a checkout session missing our eventKey", () => {
    expect(normalizeStripeEvent(checkoutCompleted({ metadata: {} }))).toBeNull();
  });

  it("resolves an expanded payment_intent object", () => {
    const ev = checkoutCompleted({
      payment_intent: { id: "pi_expanded" } as Stripe.PaymentIntent,
    });
    expect(normalizeStripeEvent(ev)?.providerPaymentIntent).toBe("pi_expanded");
  });

  it("maps payment_intent.succeeded (async methods like Swish)", () => {
    expect(normalizeStripeEvent(piSucceeded())).toMatchObject({
      providerEventId: "evt_456",
      providerPaymentIntent: "pi_xyz",
      method: "swish",
      eventKey: "evt-key-2",
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
