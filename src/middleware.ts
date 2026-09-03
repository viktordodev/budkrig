import { type NextRequest, NextResponse } from "next/server";

/**
 * Attaches a request id to every request (forwarded downstream + echoed on the
 * response) so a log line, a job, and a support question all correlate
 * (ADR-0013). Security headers that don't need per-route logic live here too;
 * the full CSP is added once asset hosts are pinned.
 */
export function middleware(req: NextRequest): NextResponse {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-request-id", requestId);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
