import { CategoryNav } from "@/components/category-nav";
import { ClaimWidget } from "@/components/claim-widget";
import { formatKr, ore, requiredMinimum } from "@/lib/money";
import { type BoardListing, getActiveBoard } from "@/modules/listings/board";
import { biddingConfig } from "@/server/config/bidding";
import { getActiveCategories } from "@/server/db/repositories/categories";
import { requestLogger } from "@/server/observability/request-id";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

// ISR: the segment is regenerated at most every 5s, and on demand when a
// settlement calls revalidatePath("/") (ADR-0009). getActiveBoard also caches
// the query in Redis so a burst of regenerations costs ~1 query per window.
export const revalidate = 5;

function hostnameOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("board");
  const params = await searchParams;
  const categorySlug = Array.isArray(params.category) ? params.category[0] : params.category;

  let listings: BoardListing[] = [];
  let degraded = false;
  try {
    listings = await getActiveBoard(50, categorySlug);
  } catch (err) {
    degraded = true;
    (await requestLogger()).error({ err }, "board query failed; serving degraded");
  }

  let categories: Awaited<ReturnType<typeof getActiveCategories>> = [];
  try {
    categories = await getActiveCategories();
  } catch (err) {
    (await requestLogger()).error({ err }, "category load failed");
  }

  const topAmountOre = listings[0]?.amountOre ?? 0;
  const nextAmountOre = requiredMinimum({
    previousAmount: ore(topAmountOre),
    newListingMin: biddingConfig.newListingMinOre,
    minIncrement: biddingConfig.minIncrementOre,
  });

  return (
    <main>
      <section className="border-b border-[var(--border)] bg-[var(--accent-soft)]">
        <div className="mx-auto max-w-3xl px-4">
          <ClaimWidget
            minAmountKr={Math.round(nextAmountOre / 100)}
            stepKr={Math.max(1, Math.round(biddingConfig.minIncrementOre / 100))}
            categories={categories}
          />
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-fg)]">
            {t("tabAllTime")}
          </span>
          <span
            title={t("comingSoon")}
            className="cursor-not-allowed rounded-full border border-[var(--border)] px-4 py-1.5 text-sm text-[var(--muted)] opacity-60"
          >
            {t("tabToday")}
          </span>
        </div>

        <div className="mb-6">
          <CategoryNav categories={categories} activeSlug={categorySlug} />
        </div>

        {degraded ? (
          <p className="text-[var(--muted)]">{t("unavailable")}</p>
        ) : listings.length === 0 ? (
          <p className="text-[var(--muted)]">{t("empty")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {listings.map((listing, index) => {
              const rank = index + 1;
              const claimForOre = requiredMinimum({
                previousAmount: ore(listing.amountOre),
                newListingMin: biddingConfig.newListingMinOre,
                minIncrement: biddingConfig.minIncrementOre,
              });
              const host = hostnameOf(listing.targetUrl);

              return (
                <li
                  key={listing.slug}
                  className={
                    rank <= 3
                      ? "rounded-xl border border-[var(--accent-soft-border)] bg-[var(--accent-soft)] p-4"
                      : "rounded-xl border border-[var(--border)] p-4"
                  }
                >
                  <div className="flex items-start gap-4">
                    <span className="w-8 shrink-0 pt-0.5 text-lg font-semibold tabular-nums text-[var(--muted)]">
                      #{rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <a
                          href={`/go/${encodeURIComponent(listing.slug)}`}
                          target="_blank"
                          rel="nofollow ugc sponsored noopener noreferrer"
                          className="font-semibold underline-offset-2 hover:underline"
                        >
                          {listing.title}
                        </a>
                        <span className="shrink-0 tabular-nums font-bold text-[var(--accent)]">
                          {formatKr(ore(listing.amountOre))}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm text-[var(--muted)]">
                        {listing.description}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--muted)]">
                        <span>{listing.categoryNameSv ?? t("uncategorized")}</span>
                        {host && (
                          <>
                            <span>·</span>
                            <span>{host}</span>
                          </>
                        )}
                        <span>·</span>
                        <span>{t("clicks", { count: listing.clickCount })}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Link
                      href={`/claim?amountKr=${Math.round(claimForOre / 100)}${
                        listing.categorySlug ? `&category=${listing.categorySlug}` : ""
                      }`}
                      className="text-sm font-medium text-[var(--accent)] hover:underline"
                    >
                      {t("claimRankFor", { amount: formatKr(ore(claimForOre)) })}
                    </Link>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </main>
  );
}
