import { db, schema } from "@/server/db/client";
import { requestLogger } from "@/server/observability/request-id";
import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClaimForm } from "./claim-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("claim");
  return { title: t("heading") };
}

export default async function ClaimPage() {
  const t = await getTranslations("claim");

  let categories: { slug: string; nameSv: string }[] = [];
  try {
    categories = await db
      .select({ slug: schema.categories.slug, nameSv: schema.categories.nameSv })
      .from(schema.categories)
      .where(eq(schema.categories.isActive, true))
      .orderBy(asc(schema.categories.sort));
  } catch (err) {
    (await requestLogger()).error({ err }, "claim page: category load failed");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{t("intro")}</p>
      <ClaimForm categories={categories} />
    </main>
  );
}
