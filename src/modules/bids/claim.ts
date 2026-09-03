import { type Ore, ZERO_ORE, ore } from "@/lib/money";
import type { Result } from "@/lib/result";
import {
  type AcceptedAmount,
  type ThresholdConfig,
  type ThresholdRejection,
  checkAmount,
} from "./threshold";
import type { ListingState } from "./types";

/**
 * Flow 1a (request side, core-flows). Pure: decides whether a claim/raise
 * request is allowed and what to charge, given the listing as it looks *right
 * now*. The resulting amounts are provisional — fulfilment (Flow 1b) recomputes
 * them against the locked row, because the board can move between request and
 * settlement (ADR-0005).
 */
export interface ClaimRequest {
  /** The listing for this slug, or null for a brand-new one. */
  readonly existing: Pick<ListingState, "currentAmountOre" | "status"> | null;
  readonly targetAmountOre: Ore;
  readonly config: ThresholdConfig;
}

export type ClaimPlan = AcceptedAmount & {
  readonly isNewListing: boolean;
};

export function planClaim(req: ClaimRequest): Result<ClaimPlan, ThresholdRejection> {
  const isNewListing = req.existing === null;
  const previousAmountOre: Ore = isNewListing ? ZERO_ORE : ore(req.existing.currentAmountOre);

  const checked = checkAmount({
    previousAmountOre,
    targetAmountOre: req.targetAmountOre,
    config: req.config,
  });
  if (!checked.ok) return checked;

  return { ok: true, value: { ...checked.value, isNewListing } };
}
