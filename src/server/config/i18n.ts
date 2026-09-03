import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import en from "../../../messages/en.json";
import sv from "../../../messages/sv.json";

/**
 * i18n WITHOUT URL locale prefixes for v1: Swedish is the default, English is
 * available via the `NEXT_LOCALE` cookie. If SEO later needs `/en` paths or an
 * `en.` subdomain, that is a deliberate change (add next-intl routing +
 * middleware + a `[locale]` segment) — recorded as an open item, not an ADR yet.
 */
export const locales = ["sv", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "sv";

const catalogs = { sv, en };

function isLocale(value: string | undefined): value is Locale {
  return value === "sv" || value === "en";
}

export default getRequestConfig(async () => {
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;
  return { locale, messages: catalogs[locale] };
});
