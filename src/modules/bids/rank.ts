/**
 * Rank is derived, never stored (ADR-0005). Board order is
 *   (current_amount_ore DESC, first_active_at ASC)
 * — a later challenger who matches an amount ranks *below* the incumbent.
 *
 * In production the board comes from one indexed query and a single listing's
 * position from one `COUNT(*)`. These pure helpers back the small-N paths:
 * tests, the `pulse` payload, reconciliation.
 */
export interface RankableListing {
  readonly id: string;
  readonly currentAmountOre: number;
  /** Must be set — only active listings are ranked, and they always have it. */
  readonly firstActiveAt: Date;
}

export function compareForBoard(a: RankableListing, b: RankableListing): number {
  if (a.currentAmountOre !== b.currentAmountOre) {
    return b.currentAmountOre - a.currentAmountOre;
  }
  const byTime = a.firstActiveAt.getTime() - b.firstActiveAt.getTime();
  if (byTime !== 0) return byTime;
  // `id` as the final tiebreaker keeps this a total order (and matches the DB
  // query: ORDER BY current_amount_ore DESC, first_active_at ASC, id ASC).
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function rankBoard<T extends RankableListing>(listings: readonly T[]): T[] {
  return [...listings].sort(compareForBoard);
}

/**
 * 1-based position of `target`. `target` may or may not appear in `others`
 * (matching by `id`); either way the answer is the same.
 */
export function positionOf(target: RankableListing, others: readonly RankableListing[]): number {
  let ahead = 0;
  for (const other of others) {
    if (other.id === target.id) continue;
    if (compareForBoard(other, target) < 0) ahead += 1;
  }
  return ahead + 1;
}
