import { count, eq } from "drizzle-orm";
import { db, schema } from "@/server/db/client";
import { assertLedger } from "@/server/db/repositories/reconcile";

/**
 * Post-load-test assertion: every `load-bid-*` settled and the ledger is
 * consistent everywhere (R2 / N1). Exits 1 on any problem.
 *   node --import tsx src/load/check-ledger.ts
 */
async function main(): Promise<void> {
  const [row] = await db
    .select({ pending: count() })
    .from(schema.bids)
    .where(eq(schema.bids.status, "pending"));
  const pending = row?.pending ?? 0;

  const mismatches = await assertLedger(db);

  if (pending > 0 || mismatches.length > 0) {
    console.error(
      JSON.stringify({ stillPending: pending, ledgerMismatches: mismatches }, null, 2),
    );
    process.exit(1);
  }

  console.log("check-ledger: all bids settled, ledger consistent");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
