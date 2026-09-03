import { db, schema } from "@/server/db/client";
import { CACHE_KEYS, cached } from "@/server/redis/cache";
import { and, asc, desc, eq } from "drizzle-orm";

/**
 * Read models for the board. The board is served from ONE query, ordered by the
 * rank key `(current_amount_ore DESC, first_active_at ASC, id ASC)` (ADR-0005;
 * `id` keeps the order total — see modules/bids/rank.ts). No per-row follow-up
 * queries — ever.
 */
export type BoardListing = {
  slug: string;
  title: string;
  description: string;
  targetUrl: string;
  amountOre: number;
  clickCount: number;
  categorySlug: string | null;
  categoryNameSv: string | null;
};

function queryActiveBoard(limit: number): Promise<BoardListing[]> {
  return db
    .select({
      slug: schema.listings.slug,
      title: schema.listings.title,
      description: schema.listings.description,
      targetUrl: schema.listings.targetUrl,
      amountOre: schema.listings.currentAmountOre,
      clickCount: schema.listings.clickCount,
      categorySlug: schema.categories.slug,
      categoryNameSv: schema.categories.nameSv,
    })
    .from(schema.listings)
    .leftJoin(schema.categories, eq(schema.listings.categoryId, schema.categories.id))
    .where(eq(schema.listings.status, "active"))
    .orderBy(
      desc(schema.listings.currentAmountOre),
      asc(schema.listings.firstActiveAt),
      asc(schema.listings.id),
    )
    .limit(limit);
}

/** Cached read (ADR-0009). Invalidated on fulfilment via `invalidateBoardCache`. */
export async function getActiveBoard(limit = 50): Promise<BoardListing[]> {
  return cached(CACHE_KEYS.board("all"), 5, () => queryActiveBoard(limit));
}

/** Where `/go/{slug}` sends the visitor. Null unless the slug is an active listing. */
export async function getRedirectTarget(
  slug: string,
): Promise<{ listingId: string; targetUrl: string } | null> {
  const [row] = await db
    .select({ listingId: schema.listings.id, targetUrl: schema.listings.targetUrl })
    .from(schema.listings)
    .where(and(eq(schema.listings.slug, slug), eq(schema.listings.status, "active")));
  return row ?? null;
}

/** Fire-and-forget click record; aggregated to `listing.click_count` by cron. */
export async function recordClick(input: {
  listingId: string;
  referrerHost: string | null;
  ipHash: string | null;
  uaHash: string | null;
}): Promise<void> {
  await db.insert(schema.clickEvents).values({
    listingId: input.listingId,
    referrerHost: input.referrerHost,
    ipHash: input.ipHash,
    uaHash: input.uaHash,
  });
}
