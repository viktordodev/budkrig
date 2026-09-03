import { NextResponse } from "next/server";

// Liveness: is the process up? No dependencies — must never touch DB/Redis.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): NextResponse {
  return NextResponse.json({ status: "ok", ts: new Date().toISOString() });
}
