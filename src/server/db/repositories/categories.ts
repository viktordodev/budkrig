import { db, schema } from "@/server/db/client";
import { asc, eq } from "drizzle-orm";

export type ActiveCategory = { slug: string; nameSv: string; nameEn: string };

/** Seeded categories, active only, in display order. */
export function getActiveCategories(): Promise<ActiveCategory[]> {
  return db
    .select({
      slug: schema.categories.slug,
      nameSv: schema.categories.nameSv,
      nameEn: schema.categories.nameEn,
    })
    .from(schema.categories)
    .where(eq(schema.categories.isActive, true))
    .orderBy(asc(schema.categories.sort));
}
