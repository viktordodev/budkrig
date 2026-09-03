/**
 * `bids` — the append-only ledger, the amount rule, and rank derivation
 * (ADR-0004 / ADR-0005).
 *
 * Built (M2 core): threshold, ledger replay + consistency, rank.
 * Next: the fulfilment transaction (`fulfil.ts`) + its `ListingRepository` /
 * `BidRepository` ports, once the payment webhook is wired.
 */
export { checkAmount } from "./threshold";
export type { AcceptedAmount, ThresholdConfig, ThresholdRejection } from "./threshold";

export { checkLedgerConsistency, currentAmountFromLedger } from "./ledger";
export type { BidLedgerEntry, LedgerInconsistency } from "./ledger";

export { compareForBoard, positionOf, rankBoard } from "./rank";
export type { RankableListing } from "./rank";
