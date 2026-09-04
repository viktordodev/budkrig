import { db, schema } from "@/server/db/client";
import { and, eq, inArray, isNull, lt } from "drizzle-orm";

/**
 * Abandoned-checkout sweep (core-flows Flow 5). A `pending` bid always has
 * `provider_payment_intent IS NULL` — the fulfilment transaction only ever
 * stamps it while flipping to `settled`, atomically. So "pending + no PI + old"
 * means the buyer never completed Stripe Checkout.
 */
export async function expirePendingBids(cutoff: Date): Promise<number> {
  return db.transaction(async (tx) => {
    const expired = await tx
      .update(schema.bids)
      .set({ status: "expired" })
      .where(
        and(
          eq(schema.bids.status, "pending"),
          isNull(schema.bids.providerPaymentIntent),
          lt(schema.bids.createdAt, cutoff),
        ),
      )
      .returning({ id: schema.bids.id });

    if (expired.length > 0) {
      await tx
        .update(schema.payments)
        .set({ status: "expired" })
        .where(
          and(
            inArray(
              schema.payments.bidId,
              expired.map((b) => b.id),
            ),
            eq(schema.payments.status, "pending"),
          ),
        );
    }
    return expired.length;
  });
}
