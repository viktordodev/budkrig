import type { SettledPaymentEvent } from "@/modules/bids/ports";
import type Stripe from "stripe";
import { toPaymentMethod } from "./method";

/**
 * Pure — turns a Stripe event into a `SettledPaymentEvent`, or null if it isn't
 * a settled payment we act on. We handle both `checkout.session.completed`
 * (card = instant) and `payment_intent.succeeded` (Swish/Klarna settle async),
 * keyed on our `eventKey` in the metadata (ADR-0006 / core-flows Flow 1b). The
 * fulfilment step is idempotent, so seeing both for one payment is fine.
 */
export function normalizeStripeEvent(event: Stripe.Event): SettledPaymentEvent | null {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") return null;

    const eventKey = session.metadata?.eventKey;
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!eventKey || !paymentIntent) return null;

    return {
      provider: "stripe",
      providerEventId: event.id,
      providerPaymentIntent: paymentIntent,
      method: toPaymentMethod(session.payment_method_types?.[0]),
      eventKey,
      type: event.type,
      payload: event,
    };
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const eventKey = intent.metadata?.eventKey;
    if (!eventKey) return null;

    return {
      provider: "stripe",
      providerEventId: event.id,
      providerPaymentIntent: intent.id,
      method: toPaymentMethod(intent.payment_method_types?.[0]),
      eventKey,
      type: event.type,
      payload: event,
    };
  }

  return null;
}
