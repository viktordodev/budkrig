import type { SettledPaymentEvent } from "@/modules/bids/ports";
import type Stripe from "stripe";
import { toPaymentMethod } from "./method";
import { deriveTaxMode, vatRateOf } from "./tax";

/**
 * Pure — turns a Stripe event into a `SettledPaymentEvent`, or null if it isn't
 * a settled payment we act on (ADR-0006 / ADR-0007). Handles:
 *  - `checkout.session.completed` with `payment_status = paid` (card = instant)
 *  - `checkout.session.async_payment_succeeded` (Swish / Klarna settle async)
 *  - `payment_intent.succeeded` (fallback; no tax breakdown)
 * Keyed on our `eventKey` in the metadata. Fulfilment is idempotent, so seeing
 * more than one event for a payment is fine.
 */
export function normalizeStripeEvent(event: Stripe.Event): SettledPaymentEvent | null {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    return fromSession(event, event.data.object as Stripe.Checkout.Session);
  }
  if (event.type === "payment_intent.succeeded") {
    return fromPaymentIntent(event, event.data.object as Stripe.PaymentIntent);
  }
  return null;
}

function fromSession(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
): SettledPaymentEvent | null {
  if (session.payment_status !== "paid") return null;

  const eventKey = session.metadata?.eventKey;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!eventKey || !paymentIntent) return null;

  const grossOre = session.amount_total ?? 0;
  const vatOre = session.total_details?.amount_tax ?? null;
  const countryCode = session.customer_details?.address?.country ?? null;
  const hasEuVatId = (session.customer_details?.tax_ids ?? []).some(
    (t) => t.type === "eu_vat" && t.value,
  );

  return {
    provider: "stripe",
    providerEventId: event.id,
    providerPaymentIntent: paymentIntent,
    method: toPaymentMethod(session.payment_method_types?.[0]),
    eventKey,
    type: event.type,
    grossOre,
    vatOre,
    vatRate: vatOre === null ? null : vatRateOf(grossOre, vatOre),
    taxMode:
      vatOre === null ? null : deriveTaxMode({ countryCode, hasEuVatId, amountTaxOre: vatOre }),
    countryCode,
    payload: event,
  };
}

function fromPaymentIntent(
  event: Stripe.Event,
  intent: Stripe.PaymentIntent,
): SettledPaymentEvent | null {
  const eventKey = intent.metadata?.eventKey;
  if (!eventKey) return null;

  return {
    provider: "stripe",
    providerEventId: event.id,
    providerPaymentIntent: intent.id,
    method: toPaymentMethod(intent.payment_method_types?.[0]),
    eventKey,
    type: event.type,
    grossOre: intent.amount,
    vatOre: null,
    vatRate: null,
    taxMode: null,
    countryCode: null,
    payload: event,
  };
}
