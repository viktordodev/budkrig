import { getStripe } from "./stripe";

/**
 * List payment_intent ids Stripe reports as `succeeded` in the last `sinceHours`.
 * Cross-check against our ledger with `findUnsettledPaymentIntents` (ADR-0006 /
 * core-flows Flow 5).
 */
export async function listRecentSucceededPaymentIntents(sinceHours = 72): Promise<string[]> {
  const stripe = getStripe();
  const createdGte = Math.floor(Date.now() / 1000) - sinceHours * 3600;

  const ids: string[] = [];
  for await (const pi of stripe.paymentIntents.list({ created: { gte: createdGte }, limit: 100 })) {
    if (pi.status === "succeeded") ids.push(pi.id);
    if (ids.length >= 1000) break; // safety cap
  }
  return ids;
}
