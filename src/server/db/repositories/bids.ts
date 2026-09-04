import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema";

type Db = PostgresJsDatabase<typeof schema>;

/**
 * Abandoned-checkout sweep (core-flows Flow 5). A `pending` bid always has
 * `provider_payment_intent IS NULL` — the fulfilment transaction only ever
 * stamps it while flipping to `settled`, atomically. So "pending + no PI + old"
 * means the buyer never completed Stripe Checkout.
 */
export async function expirePendingBids(db: Db, cutoff: Date): Promise<number> {
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
