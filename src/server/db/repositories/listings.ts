import { db, schema } from "@/server/db/client";
import { asc, desc, eq } from "drizzle-orm";

/**
 * Read models for the board. The board is served from ONE query, ordered by the
 * rank key `(current_amount_ore DESC, first_active_at ASC)` (ADR-0005). No
 * per-row follow-up queries — ever.
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

export async function getActiveBoard(limit = 50): Promise<BoardListing[]> {
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
    .orderBy(desc(schema.listings.currentAmountOre), asc(schema.listings.firstActiveAt))
    .limit(limit);
}
