/**
 * `bids` — the append-only ledger, the amount rule, rank derivation, and the
 * fulfilment decision (ADR-0004 / ADR-0005).
 *
 * Built: threshold, ledger replay + consistency, rank, `planClaim` (Flow 1a),
 * `decideFulfilment` (Flow 1b — the pure core of the fulfilment transaction).
 * Next: the `BidsRepository` port + its Postgres adapter + Testcontainers
 * integration / concurrency tests.
 */
export { planClaim } from "./claim";
export type { ClaimPlan, ClaimRequest } from "./claim";

export { decideFulfilment } from "./fulfil";
export type {
  AnomalyReason,
  FulfilmentContext,
  FulfilmentDecision,
  FulfilmentWrites,
  SkipReason,
} from "./fulfil";

export { checkAmount } from "./threshold";
export type { AcceptedAmount, ThresholdConfig, ThresholdRejection } from "./threshold";

export { checkLedgerConsistency, currentAmountFromLedger } from "./ledger";
export type { BidLedgerEntry, LedgerInconsistency } from "./ledger";

export { compareForBoard, positionOf, rankBoard } from "./rank";
export type { RankableListing } from "./rank";

export type {
  BidState,
  BidStatus,
  ListingState,
  ListingStatus,
  PaymentState,
  PaymentStatus,
} from "./types";
