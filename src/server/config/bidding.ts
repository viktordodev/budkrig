import { ore } from "@/lib/money";
import type { ThresholdConfig } from "@/modules/bids/threshold";
import { env } from "@/server/config/env";

/** Product rules, from env (ADR-0004 / ADR-0005). One source for every path. */
export const biddingConfig: ThresholdConfig = {
  newListingMinOre: ore(env.NEW_LISTING_MIN_ORE ?? 500),
  minIncrementOre: ore(env.MIN_INCREMENT_ORE ?? 100),
};
