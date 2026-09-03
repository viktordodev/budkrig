# 0010 — Redis + BullMQ for async work and cron

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

Payment fulfilment must be reliable and idempotent, and must not run inside the
webhook request (which Stripe expects to return in seconds). We also have
periodic work: expiring pending bids, Stripe reconciliation, ledger assertions,
click aggregation, OG image generation, invoice PDFs, backup verification
(core‑flows Flow 5). We need a durable queue and a scheduler that a solo
operator can run on the same box (G6), with good visibility into failures.

## Decision

- **Redis** (Coolify managed service, AOF persistence on) as the queue backend
  and as the short‑TTL read cache (ADR‑0009) and rate‑limit store.
- **BullMQ** for job queues: retries with backoff, dead‑letter, delayed jobs,
  repeatable (cron) jobs, and a decent dashboard (`bull-board`, operator‑gated).
- **The worker is the same Docker image as the web app**, started with a
  different command (`node dist/worker.js`), run as its own Coolify service
  (ADR‑0011). It shares the domain modules in `src/modules/*` and `src/server/*`.
- Job types are defined in one place (`src/server/queue/`), each with a Zod
  schema for its payload, an explicit idempotency key, and a max‑attempts +
  backoff policy.
- **Cron via BullMQ repeatable jobs** owned by the worker, with a Coolify
  scheduled‑task as a belt‑and‑braces trigger for the critical daily ones
  (backup verify).
- Webhook handler's only job: verify signature, persist the event, enqueue,
  return 200. All real work is in the worker.

## Consequences

### Positive
- Webhook stays fast; Stripe's 3‑day retry + our reconciliation job mean a
  transient worker/Redis outage doesn't lose a payment.
- Idempotent, retriable fulfilment — the core of N1/N3 reliability.
- One image, one language, shared code between web and worker — nothing to keep
  in sync, one thing to deploy.
- BullMQ dashboard gives the operator queue depth, failures, and retry control
  (N9).

### Negative / accepted trade‑offs
- Redis is now on the critical path for *fulfilment latency* (not correctness).
  Mitigated: AOF persistence, and reconciliation recovers anything dropped.
- BullMQ semantics (stalled jobs, lock duration, concurrency) need
  understanding. Documented; kept simple (low concurrency, generous lock).
- Running web + worker from one image means a deploy restarts both. Acceptable;
  jobs are retriable and the queue is durable.
- Repeatable jobs can double‑fire on deploy overlap — every job is idempotent
  anyway, and critical ones also have the Coolify trigger as a check.

### Follow‑ups
- `REDIS_URL` in `.env.example`; separate logical DBs or key prefixes for
  cache / queue / rate‑limit.
- Job registry with payload schemas + idempotency keys (`src/server/queue/`).
- `bull-board` mounted under the operator‑gated area.
- Alerts on queue depth, failed‑job count, and oldest‑waiting‑job age (N9).
- Graceful shutdown: worker finishes the in‑flight job on SIGTERM.

## Alternatives considered

- **Postgres‑backed queue (`pg-boss`, Graphile Worker)** — one fewer service,
  and appealing since we already trust Postgres. Viable fallback. We chose
  BullMQ for its maturity, tooling, and because we want Redis anyway for cache
  + rate limiting, so it's not really an "extra" service.
- **In‑process (`setTimeout`, `p-queue`) in the web app** — no durability, work
  lost on deploy/crash, competes with request handling during a spike.
  Rejected for anything touching money.
- **Managed queue (SQS, Upstash QStash, Inngest)** — subprocessor + cost +
  egress + data‑residency (R9); conflicts with the self‑hosted goal.
- **A separate worker repo/image** — version‑skew risk and two build pipelines
  for no benefit at this size.
