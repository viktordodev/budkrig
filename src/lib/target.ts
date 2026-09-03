import { type Result, err, ok } from "./result";

/**
 * A claim's target — either a website URL or an `@handle`. Pure normalisation:
 * derive a stable `slug` (the public `/product/{slug}` key and the dedup key)
 * and the outbound `targetUrl`.
 *
 * `slug` for a URL is host minus a leading `www.`, lowercased. This is NOT a
 * full public-suffix parse (`foo.co.uk` becomes `foo.co.uk`, which is fine) —
 * revisit with `tldts` if sub-path/sub-domain collisions become a problem.
 */
export type Target =
  | { readonly kind: "url"; readonly slug: string; readonly targetUrl: string }
  | { readonly kind: "handle"; readonly slug: string; readonly targetUrl: string };

export type TargetError =
  | { readonly kind: "empty" }
  | { readonly kind: "invalid_url" }
  | { readonly kind: "invalid_handle" }
  | { readonly kind: "unsupported_scheme" };

const HANDLE_HOSTS = new Set(["x.com", "twitter.com", "www.x.com", "www.twitter.com"]);
const HANDLE_RE = /^@?([a-zA-Z0-9_]{1,30})$/;

export function parseTarget(raw: string): Result<Target, TargetError> {
  const input = raw.trim();
  if (input === "") return err({ kind: "empty" });

  // Bare @handle
  if (
    input.startsWith("@") ||
    (!input.includes("/") && !input.includes(".") && HANDLE_RE.test(input))
  ) {
    const m = HANDLE_RE.exec(input);
    if (!m?.[1]) return err({ kind: "invalid_handle" });
    const handle = m[1].toLowerCase();
    return ok({ kind: "handle", slug: `@${handle}`, targetUrl: `https://x.com/${handle}` });
  }

  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(input);
  if (scheme && !/^https?$/i.test(scheme[1] ?? "")) {
    return err({ kind: "unsupported_scheme" });
  }

  let url: URL;
  try {
    url = new URL(scheme ? input : `https://${input}`);
  } catch {
    return err({ kind: "invalid_url" });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return err({ kind: "unsupported_scheme" });
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host === "" || !host.includes(".")) return err({ kind: "invalid_url" });

  // A profile URL on x.com / twitter.com → treat as a handle
  if (HANDLE_HOSTS.has(url.hostname.toLowerCase())) {
    const seg = url.pathname.split("/").filter(Boolean)[0];
    const m = seg ? HANDLE_RE.exec(seg) : null;
    if (m?.[1]) {
      const handle = m[1].toLowerCase();
      return ok({ kind: "handle", slug: `@${handle}`, targetUrl: `https://x.com/${handle}` });
    }
  }

  url.hash = "";
  url.hostname = host;
  return ok({ kind: "url", slug: host, targetUrl: url.toString() });
}

/** Append our attribution param without clobbering existing query. */
export function withUtm(targetUrl: string): string {
  try {
    const u = new URL(targetUrl);
    if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "budkrig");
    return u.toString();
  } catch {
    return targetUrl;
  }
}
