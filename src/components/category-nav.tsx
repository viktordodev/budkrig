import type { ActiveCategory } from "@/server/db/repositories/categories";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

function pillClass(active: boolean) {
  return active
    ? "shrink-0 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium text-[var(--accent-fg)]"
    : "shrink-0 rounded-full border border-[var(--border)] px-3.5 py-1.5 text-sm text-[var(--muted)] transition-colors hover:border-[var(--accent-soft-border)] hover:text-[var(--fg)]";
}

export async function CategoryNav({
  categories,
  activeSlug,
}: { categories: ActiveCategory[]; activeSlug?: string | undefined }) {
  const t = await getTranslations("board");

  return (
    <nav
      id="kategorier"
      aria-label={t("allCategories")}
      className="scrollbar-none flex gap-2 overflow-x-auto scroll-pl-4 pb-1"
    >
      <Link href="/" className={pillClass(!activeSlug)}>
        {t("allCategories")}
      </Link>
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={`/?category=${c.slug}`}
          className={pillClass(activeSlug === c.slug)}
        >
          {c.nameSv}
        </Link>
      ))}
    </nav>
  );
}
