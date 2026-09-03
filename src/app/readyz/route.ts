import { pingDb } from "@/server/db/client";
import { requestLogger } from "@/server/observability/request-id";
import { pingRedis } from "@/server/redis/client";
import { NextResponse } from "next/server";

// Readiness: can this instance serve traffic? Checks DB + Redis.
// Coolify gates the rolling restart on this (ADR-0011).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<NextResponse> {
  const [dbCheck, redisCheck] = await Promise.allSettled([pingDb(), pingRedis()]);

  const detail = {
    db: dbCheck.status === "fulfilled" ? "ok" : "down",
    redis: redisCheck.status === "fulfilled" ? "ok" : "down",
  } as const;

  const ready = dbCheck.status === "fulfilled" && redisCheck.status === "fulfilled";

  if (!ready) {
    (await requestLogger()).warn(
      {
        detail,
        dbError: dbCheck.status === "rejected" ? String(dbCheck.reason) : undefined,
        redisError: redisCheck.status === "rejected" ? String(redisCheck.reason) : undefined,
      },
      "readiness check failed",
    );
  }

  return NextResponse.json(
    { status: ready ? "ready" : "degraded", ...detail },
    { status: ready ? 200 : 503 },
  );
}
