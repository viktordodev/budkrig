import { withUtm } from "@/lib/target";
import { getRedirectTarget, recordClick } from "@/server/db/repositories/listings";
import { requestLogger } from "@/server/observability/request-id";
import { clientIpFromHeaders, hashIp } from "@/server/security/ip";
import { NextResponse } from "next/server";

// Outbound click. `slug` is looked up, never reflected — no open redirect
// (ADR-0012). Click recording is best-effort and must not delay the redirect.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;
  const home = NextResponse.redirect(new URL("/", req.url), 302);

  let target: Awaited<ReturnType<typeof getRedirectTarget>>;
  try {
    target = await getRedirectTarget(decodeURIComponent(slug));
  } catch (err) {
    (await requestLogger()).error({ err: String(err), slug }, "go: lookup failed");
    return home;
  }
  if (!target) return home;

  const headers = new Headers(req.headers);
  recordClick({
    listingId: target.listingId,
    referrerHost: safeHost(headers.get("referer")),
    ipHash: hashIp(clientIpFromHeaders(headers)),
    uaHash: headers.get("user-agent") ? hashIp(headers.get("user-agent")) : null,
  }).catch(async (err) => {
    (await requestLogger()).warn({ err: String(err), slug }, "click record failed");
  });

  return NextResponse.redirect(withUtm(target.targetUrl), 302);
}

function safeHost(referer: string | null): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).hostname;
  } catch {
    return null;
  }
}
