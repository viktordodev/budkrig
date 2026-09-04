import { getTranslations } from "next-intl/server";
import Link from "next/link";

export async function SiteHeader() {
  const [tHeader, tBoard] = await Promise.all([
    getTranslations("header"),
    getTranslations("board"),
  ]);

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-1.5 font-semibold tracking-tight">
          <span className="text-[var(--accent)]">Bud</span>
          <span>krig</span>
        </Link>
        <nav className="flex items-center gap-5 text-sm text-[var(--muted)]">
          <Link href="/#kategorier" className="transition-colors hover:text-[var(--fg)]">
            {tHeader("categories")}
          </Link>
          <Link href="/foretagsinformation" className="transition-colors hover:text-[var(--fg)]">
            {tHeader("about")}
          </Link>
          <Link href="/terms" className="transition-colors hover:text-[var(--fg)]">
            {tHeader("rules")}
          </Link>
          <Link
            href="/claim"
            className="shrink-0 rounded bg-[var(--accent)] px-3 py-1.5 font-medium text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            {tBoard("claimCta")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
