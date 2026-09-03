# 0013 — Observability and privacy‑friendly analytics stack

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

A solo operator needs to know within minutes when the money path breaks, when a
spike is straining the box, or when the site is down (N9). The product also
needs traffic analytics (it's an SEO/virality play, G5) — but under GDPR (N8,
R9) we want no cookie banner and no US data transfer. Everything should be
self‑hostable alongside the app (ADR‑0011).

## Decision

| Concern | Choice | Notes |
| --- | --- | --- |
| **Structured logs** | `pino` JSON to stdout → Coolify log drain (→ Loki if it grows) | Request id + bid id + event id on every line in the money path. No PII in logs (no raw email, no card data). |
| **Error tracking** | **GlitchTip** or self‑hosted **Sentry**, EU‑hosted | Alert to phone on new issue and on error‑rate spike. Source maps uploaded in CI. |
| **Metrics / tracing** | OpenTelemetry SDK → Prometheus + Grafana (start with Coolify's built‑in metrics) | Custom signals below. |
| **Uptime / synthetic** | **Uptime Kuma** (separate tiny host ideally, not the same VPS) | Probes `/healthz`, the board HTML, and a synthetic "can create a Checkout Session" canary. |
| **Product analytics** | **Plausible** or **Umami**, self‑hosted, cookie‑free | No consent banner needed; aggregate only. |
| **Payments view** | Stripe dashboard + a daily worker‑generated "revenue & disputes" digest email | — |

### Custom signals that page the operator

- **Webhook → fulfilment lag** p95 (target < 10 s, N5).
- **BullMQ**: queue depth, failed‑job count, oldest‑waiting‑job age.
- **Ledger assertion failures** (`assert-ledger` job) — any failure is a page.
- **`reconcile-stripe` mismatches** — settled Stripe PI with no settled bid.
- **Pending‑bid age** — anomalous backlog means checkout or webhook is broken.
- **5xx rate** and **DB connection pool saturation**.
- **Board cache hit rate** (drop = spike risk).
- **Disk free**, **Postgres age/bloat**, **backup freshness** (< 26 h old).

### Correlation

One `requestId` per inbound request (middleware), propagated to Server Actions,
enqueued jobs, and log lines. The money path additionally stamps `bidId` and
`stripeEventId`. A support question → one grep.

## Consequences

### Positive
- Detection in minutes, not "a customer emailed us" (N9).
- No cookie banner, no US transfer, all data EU + self‑hosted (N8).
- The signals map directly to the invariants that matter (N1, N3, N5).

### Negative / accepted trade‑offs
- More services to run (error tracker, Grafana, Kuma, analytics). Kept minimal;
  Kuma + GlitchTip + Plausible are each tiny. Start on Coolify's built‑ins and
  add as needed.
- Self‑hosted Sentry is heavy — prefer GlitchTip unless we outgrow it.
- Uptime monitor on the same VPS is blind to a host outage → put it elsewhere
  (a free tier or a $4 box).

### Follow‑ups
- `pino` logger + request‑id middleware; lint rule against `console.log` in
  `src/server` and `src/modules`.
- OTel bootstrap; Grafana dashboard + alert rules as code.
- `/healthz`, `/readyz`, and the Checkout‑Session canary endpoint.
- Digest email job in the worker.
- Document the alert runbook: what each page means and the first action.
- DPAs: Stripe, email provider, object storage, Safe Browsing provider.

## Alternatives considered

- **Datadog / New Relic / Sentry SaaS** — excellent, but cost + US data +
  subprocessor overhead for a solo EU product. Rejected for v1.
- **Just Coolify logs, no error tracker** — no aggregation, no alerting on new
  exceptions; you find out from users. Insufficient for a payments product.
- **GA4 for analytics** — cookie banner + GDPR/DPF headaches, and it's exactly
  the tracking we don't want to defend. Rejected.
- **No metrics until something breaks** — the spike is when you need them and
  the worst time to add them.
