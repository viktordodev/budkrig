import { getTranslations } from "next-intl/server";
import Link from "next/link";

/** Legal links + the "paid placement, not endorsed" disclaimer (ADR-0012). */
export async function SiteFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="mt-16 border-t border-[var(--border)]">
      <div className="mx-auto max-w-3xl px-4 py-8 text-xs text-[var(--muted)]">
        <p>{t("disclaimer")}</p>
        <nav className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/foretagsinformation" className="hover:text-[var(--fg)] hover:underline">
            {t("company")}
          </Link>
          <span className="text-[var(--border)]">·</span>
          <Link href="/terms" className="hover:text-[var(--fg)] hover:underline">
            {t("terms")}
          </Link>
          <span className="text-[var(--border)]">·</span>
          <Link href="/privacy" className="hover:text-[var(--fg)] hover:underline">
            {t("privacy")}
          </Link>
        </nav>
        <p className="mt-4 border-t border-[var(--border)] pt-4">{t("credit")}</p>
        <p className="mt-1">{t("prototype")}</p>
      </div>
    </footer>
  );
}
