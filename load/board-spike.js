import { check, sleep } from "k6";
import { Rate } from "k6/metrics";
import http from "k6/http";

/**
 * The read-path spike (N4 / R3). Ramps to ~2000 concurrent visitors browsing
 * the board. The board is ISR + Redis-cached (ADR-0009), so this should stay
 * fast and — critically — the DB query rate should stay flat, not scale with
 * viewers. Check `pg_stat_statements` / worker logs alongside this run.
 *
 *   k6 run -e BASE_URL=https://budkrig.viktordo.dev load/board-spike.js
 */
const BASE = __ENV.BASE_URL || "http://localhost:3000";
const errors = new Rate("errors");

export const options = {
  scenarios: {
    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "20s", target: 500 },
        { duration: "30s", target: Number(__ENV.PEAK_VUS || 2000) },
        { duration: "60s", target: Number(__ENV.PEAK_VUS || 2000) },
        { duration: "15s", target: 0 },
      ],
      gracefulRampDown: "10s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{expected_response:true}": ["p(95)<800", "p(99)<2500"],
    errors: ["rate<0.01"],
  },
};

export default function () {
  const res = http.get(`${BASE}/`, { tags: { name: "board" } });
  const ok = check(res, {
    "status 200": (r) => r.status === 200,
    "rendered the board": (r) => typeof r.body === "string" && r.body.includes("Topplistan"),
    "not degraded": (r) => typeof r.body === "string" && !r.body.includes("värms upp"),
  });
  errors.add(!ok);
  sleep(Math.random() * 2 + 0.5);
}
