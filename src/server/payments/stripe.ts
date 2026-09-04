import { env } from "@/server/config/env";
import Stripe from "stripe";
import { type CheckoutInput, buildCheckoutSessionParams } from "./checkout-params";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!client) {
    client = new Stripe(env.STRIPE_SECRET_KEY, { typescript: true });
  }
  return client;
}

/**
 * Create a hosted Checkout Session for a pending bid (ADR-0006). The bid id is
 * the idempotency key, so a retried claim can't double-charge. `taxEnabled` is
 * injected from env so the caller doesn't need to know about Stripe Tax.
 */
export async function createCheckoutSession(
  input: Omit<CheckoutInput, "taxEnabled" | "paymentMethods">,
): Promise<Stripe.Checkout.Session> {
  const params = buildCheckoutSessionParams({
    ...input,
    taxEnabled: env.STRIPE_TAX_ENABLED,
    paymentMethods: env.CHECKOUT_PAYMENT_METHODS ?? ["card"],
  });
  return getStripe().checkout.sessions.create(params, {
    idempotencyKey: `checkout_${input.bidId}`,
  });
}

/** Verify + parse an inbound webhook. Throws on a bad signature. */
export function constructWebhookEvent(rawBody: string, signature: string): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return getStripe().webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
}
