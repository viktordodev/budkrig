import { createHash } from "node:crypto";
import { env } from "@/server/config/env";

/**
 * A salted hash of the client IP — for rate limiting and abuse only, never
 * stored or logged raw (ADR-0013 / GDPR data minimisation).
 */
export function hashIp(ip: string | null | undefined): string {
  const salt = env.IP_HASH_SALT ?? "dev-salt";
  return createHash("sha256")
    .update(`${salt}:${ip ?? "unknown"}`)
    .digest("hex")
    .slice(0, 32);
}

/** Best-effort client IP from proxy headers (Coolify/Traefik sets these). */
export function clientIpFromHeaders(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return headers.get("x-real-ip");
}
