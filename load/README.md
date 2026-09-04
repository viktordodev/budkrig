# Load tests (k6)

The two failure modes that matter under load (ADR-0014, risks R2 + R3):

| Script | Asserts |
| --- | --- |
| `board-spike.js` | ~2000 concurrent visitors browsing `/` stay fast (p95 < 800 ms) and error‑free. The board is ISR + Redis‑cached (ADR‑0009) so DB load should stay **flat** — watch `pg_stat_statements` / the worker logs during the run. |
| `webhook-burst.js` | `BID_COUNT` signed `checkout.session.completed` events fired concurrently at `/api/webhooks/stripe`; verify + enqueue stays under p95 1 s. Then `src/load/check-ledger.ts` proves every bid settled and the ledger stayed consistent — the real R2 check. |

## Run against the deployed preview

```bash
k6 run -e BASE_URL=https://budkrig.viktordo.dev load/board-spike.js
```

## Run the full settlement burst locally

```bash
pnpm infra:up                       # postgres + redis
pnpm db:migrate && pnpm db:seed
pnpm build && pnpm start &           # web (needs a Stripe webhook secret in .env)
pnpm worker &                        # or: node dist/workers/main.js
BID_COUNT=500 node --import tsx src/load/seed-pending.ts
k6 run -e STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET -e BID_COUNT=500 load/webhook-burst.js
sleep 20
node --import tsx src/load/check-ledger.ts
```

## CI

`.github/workflows/load.yml` runs the whole thing nightly (03:00 UTC) and on
manual dispatch (`peak_vus`, `bid_count` inputs). It is **not** a per‑PR gate.
