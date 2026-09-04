import { requestLogger } from "@/server/observability/request-id";
import { normalizeStripeEvent } from "@/server/payments/normalize";
import { constructWebhookEvent } from "@/server/payments/stripe";
import { enqueueFulfilPayment } from "@/server/queue/jobs";
import { NextResponse } from "next/server";

// Needs the raw body + a stable URL, so it's a Route Handler, not a Server
// Action (ADR-0002). Verify → normalise → enqueue → 200, fast (ADR-0010). The
// worker does the fulfilment transaction + cache invalidation.
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

  // A Redis failure here surfaces as 500 → Stripe retries for up to 3 days, and
  // reconcile-stripe is the final backstop.
  await enqueueFulfilPayment(settled);
  log.info({ stripeEventId: event.id, type: event.type }, "stripe webhook enqueued");

  return NextResponse.json({ received: true, queued: true });
}
