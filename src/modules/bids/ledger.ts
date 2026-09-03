import { type Ore, ZERO_ORE, ore } from "@/lib/money";
import { type Result, err, ok } from "@/lib/result";

/**
 * The bid table is an append-only ledger (ADR-0004). A listing's
 * `current_amount_ore` is a derived cache; these functions are the source of
 * truth it is reconciled against (core-flows Flow 5, `assert-ledger`).
 *
 * The chain order is defined by the AMOUNTS, not by `settled_at` — settlements
 * are serialised on the listing row, and `resulting = previous + delta` with
 * amounts strictly increasing, so ordering by `previous_amount_ore` reproduces
 * the exact order they were applied. (Two settlements can share a `settled_at`
 * down to the millisecond.)
 */
export interface BidLedgerEntry {
  readonly previousAmountOre: number;
  readonly deltaOre: number;
  readonly resultingAmountOre: number;
  readonly status: "pending" | "settled" | "expired" | "refunded";
  readonly settledAt: Date | null;
}

/**
 * Invariant 2: current amount = the resulting amount of the last settled bid in
 * the chain = the largest resulting amount among settled bids, or 0.
 */
export function currentAmountFromLedger(entries: readonly BidLedgerEntry[]): Ore {
  let max = 0;
  for (const e of entries) {
    if (e.status === "settled" && e.resultingAmountOre > max) max = e.resultingAmountOre;
  }
  return max === 0 ? ZERO_ORE : ore(max);
}

export type LedgerInconsistency =
  | { readonly kind: "delta_not_positive"; readonly settledIndex: number }
  | { readonly kind: "arithmetic_mismatch"; readonly settledIndex: number }
  | { readonly kind: "chain_break"; readonly settledIndex: number }
  | { readonly kind: "non_monotonic"; readonly settledIndex: number };

/**
 * Checks the settled bids form a consistent chain (ADR-0004 invariants 3, 4 +
 * cross-row continuity maintained by the fulfilment transaction), ordered by
 * `previous_amount_ore`:
 *  - each delta > 0
 *  - resulting = previous + delta
 *  - each bid's previous = the prior settled bid's resulting (0 for the first)
 *  - settled amounts strictly increase
 */
export function checkLedgerConsistency(
  entries: readonly BidLedgerEntry[],
): Result<void, LedgerInconsistency> {
  const settled = entries
    .filter((e) => e.status === "settled")
    .sort((a, b) => a.previousAmountOre - b.previousAmountOre);

  let expectedPrevious = 0;
  for (const [settledIndex, e] of settled.entries()) {
    if (e.deltaOre <= 0) return err({ kind: "delta_not_positive", settledIndex });
    if (e.resultingAmountOre !== e.previousAmountOre + e.deltaOre) {
      return err({ kind: "arithmetic_mismatch", settledIndex });
    }
    if (e.previousAmountOre !== expectedPrevious) {
      return err({ kind: "chain_break", settledIndex });
    }
    if (e.resultingAmountOre <= expectedPrevious) {
      return err({ kind: "non_monotonic", settledIndex });
    }
    expectedPrevious = e.resultingAmountOre;
  }
  return ok(undefined);
}
