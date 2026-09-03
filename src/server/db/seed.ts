import { fromKronor } from "@/lib/money";
import { db, schema } from "@/server/db/client";
import { logger } from "@/server/observability/logger";

/**
 * Idempotent seed: category set (Swedish-labelled, mirrors outbid.lol) + a
 * couple of demo listings so the board renders. Safe to run repeatedly.
 * Run: pnpm db:seed
 */
const CATEGORIES = [
  {
    slug: "seo-ai-synlighet",
    nameSv: "SEO & AI-synlighet",
    nameEn: "SEO & AI visibility",
    sort: 1,
  },
  {
    slug: "marknadsforing",
    nameSv: "Marknadsföring & annonsering",
    nameEn: "Marketing & advertising",
    sort: 2,
  },
  {
    slug: "produktivitet",
    nameSv: "Produktivitet & verktyg",
    nameEn: "Productivity & tools",
    sort: 3,
  },
  {
    slug: "ai-agenter",
    nameSv: "AI-agenter & infrastruktur",
    nameEn: "AI agents & infrastructure",
    sort: 4,
  },
  { slug: "utvecklarverktyg", nameSv: "Utvecklarverktyg", nameEn: "Developer tools", sort: 5 },
  { slug: "e-handel", nameSv: "E-handel & detaljhandel", nameEn: "Ecommerce & retail", sort: 6 },
  {
    slug: "ekonomi-juridik",
    nameSv: "Ekonomi, finans & juridik",
    nameEn: "Business, finance & legal",
    sort: 7,
  },
  { slug: "ovrigt", nameSv: "Övrigt", nameEn: "Other", sort: 99 },
];

const DEMO_LISTINGS = [
  {
    slug: "exempel.se",
    title: "Exempel — så här ser en listning ut",
    description: "En demolistning. Klicka på titeln för att öppna länken.",
    targetUrl: "https://exempel.se",
    categorySlug: "ovrigt",
    kronor: 5000,
  },
  {
    slug: "@budkrig",
    title: "@budkrig på X",
    description: "Ett @handle-exempel för topplistan.",
    targetUrl: "https://x.com/budkrig",
    categorySlug: "marknadsforing",
    kronor: 1500,
  },
];

async function main(): Promise<void> {
  await db
    .insert(schema.categories)
    .values(CATEGORIES)
    .onConflictDoNothing({ target: schema.categories.slug });

  const categories = await db.select().from(schema.categories);
  const idBySlug = new Map(categories.map((c) => [c.slug, c.id]));

  for (const [index, listing] of DEMO_LISTINGS.entries()) {
    const categoryId = idBySlug.get(listing.categorySlug);
    if (!categoryId) throw new Error(`seed: unknown category "${listing.categorySlug}"`);

    await db
      .insert(schema.listings)
      .values({
        slug: listing.slug,
        kind: listing.slug.startsWith("@") ? "handle" : "url",
        targetUrl: listing.targetUrl,
        title: listing.title,
        description: listing.description,
        categoryId,
        currentAmountOre: fromKronor(listing.kronor),
        status: "active",
        ownerEmail: "demo@budkrig.se",
        // stagger first_active_at so ranking ties (if any) are deterministic
        firstActiveAt: new Date(Date.now() - (DEMO_LISTINGS.length - index) * 60_000),
        lastBidAt: new Date(),
      })
      .onConflictDoNothing({ target: schema.listings.slug });
  }

  logger.info({ categories: CATEGORIES.length, listings: DEMO_LISTINGS.length }, "seed complete");
  process.exit(0);
}

main().catch((err) => {
  logger.error({ err }, "seed failed");
  process.exit(1);
});
