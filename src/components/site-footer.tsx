import { getTranslations } from "next-intl/server";
import Link from "next/link";

/** Legal links + the "paid placement, not endorsed" disclaimer (ADR-0012). */
export async function SiteFooter() {
  const t = await getTranslations("footer");

  return (
    <footer className="mx-auto mt-16 max-w-2xl border-t border-[var(--border)] px-4 py-8 text-xs text-[var(--muted)]">
      <p>{t("disclaimer")}</p>
      <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/foretagsinformation" className="hover:underline">
          {t("company")}
        </Link>
        <Link href="/terms" className="hover:underline">
          {t("terms")}
        </Link>
        <Link href="/privacy" className="hover:underline">
          {t("privacy")}
        </Link>
      </nav>
      <p className="mt-3">{t("prototype")}</p>
    </footer>
  );
}
