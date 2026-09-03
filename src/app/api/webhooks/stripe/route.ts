import { systemClock } from "@/modules/bids/ports";
import { biddingConfig } from "@/server/config/bidding";
import { db } from "@/server/db/client";
import { createFulfilmentRepository } from "@/server/db/repositories/fulfilment";
import { requestLogger } from "@/server/observability/request-id";
import { normalizeStripeEvent } from "@/server/payments/normalize";
import { constructWebhookEvent } from "@/server/payments/stripe";
import { NextResponse } from "next/server";

// Needs the raw body + a stable URL, so it's a Route Handler, not a Server
// Action (ADR-0002). Runs fulfilment synchronously for now; the queue slice
// moves it to a BullMQ job and also enqueues the receipt + cache invalidation.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  const log = await requestLogger();

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing stripe-signature" }, { status: 400 });
  }

  const rawBody = await req.text();

  let event: ReturnType<typeof constructWebhookEvent>;
  try {
    event = constructWebhookEvent(rawBody, signature);
  } catch (error) {
    log.warn({ error: String(error) }, "stripe webhook: signature verification failed");
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const settled = normalizeStripeEvent(event);
  if (!settled) {
    return NextResponse.json({ received: true, handled: false });
  }

  const repo = createFulfilmentRepository(db, biddingConfig, systemClock);
  const decision = await repo.fulfil(settled);

  log.info(
    { stripeEventId: event.id, type: event.type, decision: decision.kind },
    "stripe webhook processed",
  );

  return NextResponse.json({ received: true, decision: decision.kind });
}
