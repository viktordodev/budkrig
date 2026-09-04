# `workers/` — background processing

Same Docker image as the web app, started with `node dist/workers/main.js`
(ADR-0010 / ADR-0011). Composition root: wires `server/` adapters into
`modules/` functions, like `app/`.

`main.ts` starts two BullMQ workers and the repeatable schedulers, and drains
in-flight jobs on SIGTERM. Processors are plain async functions in
`processors/` so they're unit-testable against Testcontainers Postgres without
running BullMQ.

| Queue / job | Trigger | Processor | Idempotency |
| --- | --- | --- | --- |
| `fulfilment` / `fulfil-payment` | Stripe webhook enqueues (`server/queue/jobs.ts`) | `processFulfilPayment` → `createFulfilmentRepository().fulfil()` + board-cache invalidation. `bid_missing` throws (retry); `anomaly` logs (no retry). | `jobId = stripe:<event id>` + the fulfilment tx itself |
| `maintenance` / `expire-pending` | every 5 min | `processExpirePending` → `expirePendingBids(now − TTL)` | idempotent query |
| `maintenance` / `assert-ledger` | hourly (`7 * * * *`) | `processAssertLedger` → `assertLedger()`, logs any drift | — |
| `maintenance` / `reconcile-stripe` | hourly (`23 * * * *`) | `processReconcileStripe` → succeeded PIs with no settled bid | — |

Still to build: `send-receipt` / `generate-invoice` (after fulfilment),
`aggregate-clicks`, `render-og-image`, `db-backup-verify`, `revenue-digest`.
