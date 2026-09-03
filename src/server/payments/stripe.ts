import { env } from "@/server/config/env";
import Stripe from "stripe";
import { type CheckoutInput, buildCheckoutSessionParams } from "./checkout-params";

let client: Stripe | null = null;

function getStripe(): Stripe {
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
 * the idempotency key, so a retried claim can't double-charge.
 */
export async function createCheckoutSession(
  input: CheckoutInput,
): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create(buildCheckoutSessionParams(input), {
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
