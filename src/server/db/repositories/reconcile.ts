import {
  type BidLedgerEntry,
  checkLedgerConsistency,
  currentAmountFromLedger,
} from "@/modules/bids/ledger";
import { and, eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema";

type Db = PostgresJsDatabase<typeof schema>;

export interface LedgerMismatch {
  readonly listingId: string;
  readonly slug: string;
  readonly cachedAmountOre: number;
  readonly ledgerAmountOre: number;
  readonly inconsistency: string | null;
}

/**
 * `assert-ledger` (core-flows Flow 5). For every non-removed listing, replay its
 * settled bids and compare to the cached `current_amount_ore` (ADR-0004
 * invariant 2). One query per listing — fine off the hot path; batch if the
 * listing count ever makes it slow.
 */
export async function assertLedger(db: Db): Promise<LedgerMismatch[]> {
  const listings = await db
    .select({
      id: schema.listings.id,
      slug: schema.listings.slug,
      currentAmountOre: schema.listings.currentAmountOre,
    })
    .from(schema.listings)
    .where(inArray(schema.listings.status, ["active", "hidden", "pending_payment"]));

  const mismatches: LedgerMismatch[] = [];
  for (const listing of listings) {
    const rows = await db
      .select({
        previousAmountOre: schema.bids.previousAmountOre,
        deltaOre: schema.bids.deltaOre,
        resultingAmountOre: schema.bids.resultingAmountOre,
        status: schema.bids.status,
        settledAt: schema.bids.settledAt,
      })
      .from(schema.bids)
      .where(eq(schema.bids.listingId, listing.id));

    const ledger: BidLedgerEntry[] = rows.map((r) => ({
      previousAmountOre: r.previousAmountOre ?? 0,
      deltaOre: r.deltaOre,
      resultingAmountOre: r.resultingAmountOre ?? 0,
      status: r.status,
      settledAt: r.settledAt,
    }));

    const ledgerAmountOre = currentAmountFromLedger(ledger);
    const consistency = checkLedgerConsistency(ledger);

    if (ledgerAmountOre !== listing.currentAmountOre || !consistency.ok) {
      mismatches.push({
        listingId: listing.id,
        slug: listing.slug,
        cachedAmountOre: listing.currentAmountOre,
        ledgerAmountOre,
        inconsistency: consistency.ok ? null : consistency.error.kind,
      });
    }
  }
  return mismatches;
}

/**
 * `reconcile-stripe` (core-flows Flow 5). Given payment_intent ids Stripe
 * reports as succeeded, return the ones we have no settled bid for — money
 * taken but not fulfilled (a missed webhook). The Stripe listing itself lives
 * in server/payments/reconcile.ts.
 */
export async function findUnsettledPaymentIntents(
  db: Db,
  paymentIntentIds: string[],
): Promise<string[]> {
  if (paymentIntentIds.length === 0) return [];
  const settled = await db
    .select({ pi: schema.bids.providerPaymentIntent })
    .from(schema.bids)
    .where(
      and(
        eq(schema.bids.status, "settled"),
        inArray(schema.bids.providerPaymentIntent, paymentIntentIds),
      ),
    );
  const settledSet = new Set(settled.map((s) => s.pi));
  return paymentIntentIds.filter((id) => !settledSet.has(id));
}
