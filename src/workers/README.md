# `workers/` — background processing

Same Docker image as the web app, started with `node dist/workers/main.js`
(ADR-0010 / ADR-0011). Composition root: wires `server/` adapters into
`modules/` functions, exactly like `app/`.

`main.ts` starts the BullMQ workers and the repeatable (cron) jobs, and handles
graceful shutdown (finish the in-flight job on SIGTERM).

Processors (core-flows Flow 1b + Flow 5):

| Job | Trigger | Idempotency key |
| --- | --- | --- |
| `fulfil-payment` | Stripe webhook | Stripe event id |
| `send-receipt` | after fulfilment | bid id |
| `generate-invoice` | after fulfilment | bid id |
| `render-og-image` | listing created/edited | listing id + content hash |
| `expire-pending` | cron 5m | — (idempotent by query) |
| `reconcile-stripe` | cron 1h | — |
| `assert-ledger` | cron 1h | — |
| `aggregate-clicks` | cron 5m | — |
| `db-backup-verify` | cron daily (+ Coolify task) | date |
| `revenue-digest` | cron daily | date |

Every processor: validate payload (Zod), be idempotent, log with
`requestId`/`bidId`, fail loud (the job retries).
