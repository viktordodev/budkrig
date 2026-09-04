import { check } from "k6";
import crypto from "k6/crypto";
import exec from "k6/execution";
import http from "k6/http";

/**
 * Fulfilment path under load (R2 / N3). Fires BID_COUNT signed
 * `checkout.session.completed` events at the webhook, concurrently, for the
 * pending bids created by `src/load/seed-pending.ts` (eventKey `load-bid-<i>`).
 *
 * The webhook only verifies + enqueues, so this measures verify+enqueue
 * throughput. Run `src/load/check-ledger.ts` afterwards to prove every bid
 * settled and the ledger stayed consistent.
 *
 *   k6 run -e BASE_URL=... -e STRIPE_WEBHOOK_SECRET=whsec_... -e BID_COUNT=500 \
 *     load/webhook-burst.js
 */
const BASE = __ENV.BASE_URL || "http://localhost:3000";
const SECRET = __ENV.STRIPE_WEBHOOK_SECRET;
const BID_COUNT = Number(__ENV.BID_COUNT || 500);

export const options = {
  scenarios: {
    burst: {
      executor: "shared-iterations",
      vus: Number(__ENV.VUS || 50),
      iterations: BID_COUNT,
      maxDuration: "180s",
    },
  },
  thresholds: {
    "http_req_duration{name:webhook}": ["p(95)<1000", "p(99)<3000"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
};

export function setup() {
  if (!SECRET) throw new Error("STRIPE_WEBHOOK_SECRET is required");
}

export default function () {
  const idx = exec.scenario.iterationInTest;
  const event = {
    id: `evt_load_${idx}`,
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        object: "checkout.session",
        payment_status: "paid",
        payment_intent: `pi_load_${idx}`,
        payment_method_types: ["card"],
        metadata: { eventKey: `load-bid-${idx}` },
      },
    },
  };

  const payload = JSON.stringify(event);
  const ts = Math.floor(Date.now() / 1000);
  const signature = crypto.hmac("sha256", SECRET, `${ts}.${payload}`, "hex");

  const res = http.post(`${BASE}/api/webhooks/stripe`, payload, {
    headers: {
      "Content-Type": "application/json",
      "Stripe-Signature": `t=${ts},v1=${signature}`,
    },
    tags: { name: "webhook" },
  });

  check(res, {
    "status 200": (r) => r.status === 200,
    "queued": (r) => typeof r.body === "string" && r.body.includes("queued"),
  });
}
