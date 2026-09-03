import { formatKr, ore } from "@/lib/money";
import { type BoardListing, getActiveBoard } from "@/modules/listings/board";
import { requestLogger } from "@/server/observability/request-id";
import { getTranslations } from "next-intl/server";

// The board reads the DB. Caching (revalidate + on-demand invalidation) is
// ADR-0009 and lands in M2; for the skeleton we render fresh every request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const t = await getTranslations("board");
  const tf = await getTranslations("footer");

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
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">{t("heading")}</h1>
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
                  href={listing.targetUrl}
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

      <footer className="mt-12 text-xs text-[var(--muted)]">{tf("builtWith")}</footer>
    </main>
  );
}
