import { formatKr, ore } from "@/lib/money";
import { type BoardListing, getActiveBoard } from "@/modules/listings/board";
import { requestLogger } from "@/server/observability/request-id";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

// ISR: the segment is regenerated at most every 5s, and on demand when a
// settlement calls revalidatePath("/") (ADR-0009). getActiveBoard also caches
// the query in Redis so a burst of regenerations costs ~1 query per window.
export const revalidate = 5;

export default async function HomePage() {
  const t = await getTranslations("board");

  let listings: BoardListing[] = [];
  let degraded = false;
  try {
    listings = await getActiveBoard(50);
  } catch (err) {
    degraded = true;
    (await requestLogger()).error({ err }, "board query failed; serving degraded");
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
        <Link
          href="/claim"
          className="shrink-0 rounded bg-[var(--fg)] px-3 py-1.5 text-sm font-medium text-[var(--bg)]"
        >
          {t("claimCta")}
        </Link>
      </header>

      {degraded ? (
        <p className="text-[var(--muted)]">{t("unavailable")}</p>
      ) : listings.length === 0 ? (
        <p className="text-[var(--muted)]">{t("empty")}</p>
      ) : (
        <ol className="divide-y divide-[var(--border)]">
          {listings.map((listing, index) => (
            <li key={listing.slug} className="flex items-baseline gap-4 py-4">
              <span className="w-10 shrink-0 tabular-nums text-[var(--muted)]">#{index + 1}</span>
              <div className="min-w-0 flex-1">
                <a
                  href={`/go/${encodeURIComponent(listing.slug)}`}
                  target="_blank"
                  rel="nofollow ugc sponsored noopener noreferrer"
                  className="font-medium underline-offset-2 hover:underline"
                >
                  {listing.title}
                </a>
                <p className="truncate text-sm text-[var(--muted)]">{listing.description}</p>
              </div>
              <span className="shrink-0 tabular-nums font-medium">
                {formatKr(ore(listing.amountOre))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
