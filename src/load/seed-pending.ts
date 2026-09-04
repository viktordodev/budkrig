import { eq } from "drizzle-orm";
import { fromKronor } from "@/lib/money";
import { db, schema } from "@/server/db/client";
import { logger } from "@/server/observability/logger";

/**
 * Creates BID_COUNT pending bids (eventKey `load-bid-<i>`), each on its own
 * fresh `pending_payment` listing, for `load/webhook-burst.js`. Idempotent.
 *   BID_COUNT=500 node --import tsx src/load/seed-pending.ts
 */
const BID_COUNT = Number(process.env.BID_COUNT ?? 500);

async function main(): Promise<void> {
  const [existing] = await db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(eq(schema.categories.slug, "load"));
  const categoryId =
    existing?.id ??
    (
      await db
        .insert(schema.categories)
        .values({ slug: "load", nameSv: "Load", nameEn: "Load", sort: 999 })
        .returning({ id: schema.categories.id })
    )[0]?.id;
  if (!categoryId) throw new Error("seed-pending: could not resolve load category");

  const listingValues = Array.from({ length: BID_COUNT }, (_, i) => ({
    slug: `load-${i}.test`,
    kind: "url" as const,
    targetUrl: "https://load.test",
    title: `Load listing ${i}`,
    description: "load-test listing",
    categoryId,
    ownerEmail: "load@budkrig.test",
    status: "pending_payment" as const,
    currentAmountOre: 0,
  }));

  for (let i = 0; i < listingValues.length; i += 200) {
    await db
      .insert(schema.listings)
      .values(listingValues.slice(i, i + 200))
      .onConflictDoNothing({ target: schema.listings.slug });
  }

  const listings = await db
    .select({ id: schema.listings.id, slug: schema.listings.slug })
    .from(schema.listings)
    .where(eq(schema.listings.categoryId, categoryId));
  const idBySlug = new Map(listings.map((l) => [l.slug, l.id]));

  const bidValues = Array.from({ length: BID_COUNT }, (_, i) => ({
    listingId: idBySlug.get(`load-${i}.test`),
    deltaOre: fromKronor(500 + i),
    status: "pending" as const,
    eventKey: `load-bid-${i}`,
  })).filter((b): b is typeof b & { listingId: string } => b.listingId !== undefined);

  for (let i = 0; i < bidValues.length; i += 200) {
    const chunk = bidValues.slice(i, i + 200);
    const inserted = await db
      .insert(schema.bids)
      .values(chunk)
      .onConflictDoNothing({ target: schema.bids.eventKey })
      .returning({ id: schema.bids.id });
    if (inserted.length > 0) {
      await db.insert(schema.payments).values(
        inserted.map((b, j) => ({
          bidId: b.id,
          provider: "stripe" as const,
          amountOre: chunk[j]?.deltaOre ?? 0,
          currency: "SEK",
          status: "pending" as const,
        })),
      );
    }
  }

  logger.info({ bidCount: BID_COUNT }, "seed-pending done");
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, "seed-pending failed");
  process.exit(1);
});
