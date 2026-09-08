import { getActiveCategories } from "@/server/db/repositories/categories";
import { requestLogger } from "@/server/observability/request-id";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClaimForm } from "./claim-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("claim");
  return { title: t("heading") };
}

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("claim");
  const params = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  let categories: { slug: string; nameSv: string }[] = [];
  try {
    categories = await getActiveCategories();
  } catch (err) {
    (await requestLogger()).error({ err }, "claim page: category load failed");
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{t("intro")}</p>
      <ClaimForm
        categories={categories}
        defaultCategory={first(params.category)}
        defaultAmountKr={first(params.amountKr)}
        defaultTarget={first(params.target)}
      />
    </main>
  );
}
