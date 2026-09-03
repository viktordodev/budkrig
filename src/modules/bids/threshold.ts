import { type Ore, requiredMinimum, subOre } from "@/lib/money";
import { type Result, err, ok } from "@/lib/result";

/**
 * The claim/raise amount rule (ADR-0005, domain-model invariant 8).
 *
 * A claim or raise must clear:
 *   max(newListingMinOre, previousAmountOre + minIncrementOre)
 *
 * `previousAmountOre` is 0 for a brand-new listing. Amounts are absolute
 * (ADR-0005) — there is no scarce rank slot, so this is the ONLY gate.
 */
export interface ThresholdConfig {
  readonly newListingMinOre: Ore;
  readonly minIncrementOre: Ore;
}

export type ThresholdRejection = {
  readonly kind: "below_minimum";
  /** The smallest target that would be accepted right now. */
  readonly requiredOre: Ore;
  readonly gotOre: Ore;
};

export interface AcceptedAmount {
  readonly previousAmountOre: Ore;
  /** What to charge for this bid. Always > 0. */
  readonly deltaOre: Ore;
  readonly resultingAmountOre: Ore;
}

export function checkAmount(input: {
  previousAmountOre: Ore;
  targetAmountOre: Ore;
  config: ThresholdConfig;
}): Result<AcceptedAmount, ThresholdRejection> {
  const requiredOre = requiredMinimum({
    previousAmount: input.previousAmountOre,
    newListingMin: input.config.newListingMinOre,
    minIncrement: input.config.minIncrementOre,
  });

  if (input.targetAmountOre < requiredOre) {
    return err({ kind: "below_minimum", requiredOre, gotOre: input.targetAmountOre });
  }

  return ok({
    previousAmountOre: input.previousAmountOre,
    deltaOre: subOre(input.targetAmountOre, input.previousAmountOre),
    resultingAmountOre: input.targetAmountOre,
  });
}
