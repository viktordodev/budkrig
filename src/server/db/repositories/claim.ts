import { type Result, err, ok } from "@/lib/result";
import { planClaim } from "@/modules/bids/claim";
import type {
  ClaimError,
  ClaimInput,
  ClaimRepository,
  Clock,
  PendingBid,
} from "@/modules/bids/ports";
import type { ThresholdConfig } from "@/modules/bids/threshold";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../schema";

type Db = PostgresJsDatabase<typeof schema>;

/**
 * Flow 1a (core-flows). One transaction:
 *  - resolve the category
 *  - upsert the listing by slug (ON CONFLICT DO NOTHING), then SELECT ... FOR
 *    UPDATE so concurrent claims for the same new slug serialise on one row
 *  - `planClaim` against the listing's current amount
 *  - insert a pending bid (+ withdrawal consent) and a pending payment
 *
 * Nothing here is visible on the board — that waits for fulfilment.
 */
export function createClaimRepository(
  db: Db,
  config: ThresholdConfig,
  clock: Clock,
): ClaimRepository {
  return {
    async createPendingBid(input): Promise<Result<PendingBid, ClaimError>> {
      return db.transaction(async (tx) => {
        const [category] = await tx
          .select({ id: schema.categories.id })
          .from(schema.categories)
          .where(eq(schema.categories.slug, input.categorySlug));
        if (!category) return err<ClaimError>({ kind: "unknown_category" });

        await tx
          .insert(schema.listings)
          .values({
            slug: input.slug,
            kind: input.kind,
            targetUrl: input.targetUrl,
            title: input.title,
            description: input.description,
            categoryId: category.id,
            ownerEmail: input.ownerEmail,
            status: "pending_payment",
            currentAmountOre: 0,
          })
          .onConflictDoNothing({ target: schema.listings.slug });

        const [listing] = await tx
          .select()
          .from(schema.listings)
          .where(eq(schema.listings.slug, input.slug))
          .for("update");

        // `listing` exists now (we just inserted it or it was already there).
        if (!listing || listing.status === "removed") {
          return err<ClaimError>({ kind: "listing_removed" });
        }

        const plan = planClaim({
          existing:
            listing.firstActiveAt === null
              ? null
              : { currentAmountOre: listing.currentAmountOre, status: listing.status },
          targetAmountOre: input.targetAmountOre,
          config,
        });
        if (!plan.ok) {
          return err<ClaimError>({ kind: "below_minimum", requiredOre: plan.error.requiredOre });
        }

        const now = clock.now();
        const [bid] = await tx
          .insert(schema.bids)
          .values({
            listingId: listing.id,
            deltaOre: plan.value.deltaOre,
            status: "pending",
            eventKey: input.eventKey,
            clientIpHash: input.clientIpHash,
            withdrawalConsentVersion: input.withdrawalConsentVersion,
            withdrawalConsentAt: now,
          })
          .returning({ id: schema.bids.id });
        if (!bid) throw new Error("claim: bid insert returned no row");

        await tx.insert(schema.payments).values({
          bidId: bid.id,
          provider: "stripe",
          amountOre: plan.value.deltaOre,
          currency: "SEK",
          status: "pending",
        });

        return ok<PendingBid>({
          bidId: bid.id,
          listingId: listing.id,
          listingSlug: input.slug,
          eventKey: input.eventKey,
          deltaOre: plan.value.deltaOre,
          isNewListing: listing.firstActiveAt === null,
        });
      });
    },
  };
}
