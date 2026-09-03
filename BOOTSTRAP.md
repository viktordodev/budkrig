# Bootstrap — from this scaffold to a running app

Tracks Milestone 1 in [`docs/architecture/00-overview.md`](docs/architecture/00-overview.md).

## Milestone 1 status

**Done (branch `milestone-1-walking-skeleton`):** toolchain installed +
lockfile; Next.js App Router shell (Tailwind v4, next-intl `sv`/`en`, no locale
prefix); `pino` logger + `x-request-id` middleware + `instrumentation.ts` error
seam; Drizzle client + first migration (`0000_*`, includes `invoice_number_seq`)
+ idempotent seed; `GET /healthz` (liveness) and `GET /readyz` (DB+Redis
readiness); home page renders the board from the DB and **degrades gracefully**
when the DB is down; BullMQ worker (`dist/workers/main.js`) with a heartbeat
job scheduler + graceful shutdown; multi-stage Dockerfile (one image, web +
worker roles); CI = typecheck · lint · test · build · standalone `/healthz`
smoke · docker image build. `pnpm typecheck && pnpm lint && pnpm test &&
pnpm build` all pass locally.

**Still needs infra (you):**
- Run against real Postgres/Redis: `pnpm infra:up` (needs Docker) →
  `pnpm db:migrate && pnpm db:seed` → confirm `/readyz` returns 200 and the
  board shows the seed rows.
- Wire error tracking — set `SENTRY_DSN` (GlitchTip or self-hosted Sentry) and
  finish `src/instrumentation.ts`.
- Coolify: follow [`docs/runbooks/coolify-setup.md`](docs/runbooks/coolify-setup.md)
  — web + worker services, Postgres + Redis, `node_modules/.bin/drizzle-kit
  migrate` as the pre-deploy command, env vars, deploy-webhook secrets.
- Uptime monitor on a **separate** host hitting `/healthz`.
- **Backup + restore rehearsal** once by hand, then automated; write
  `docs/runbooks/restore.md`.

## Prerequisites

- Node ≥ 22 (repo targets 24 — see `.nvmrc`); `pnpm` (`corepack enable` or
  `npm i -g pnpm`)
- Docker (for local Postgres/Redis and to build the image)
- A Stripe test-mode account + the Stripe CLI (Milestone 2)

## Run it locally

```bash
pnpm install
cp .env.example .env          # fill LISTING_MANAGEMENT_JWT_SECRET + IP_HASH_SALT
pnpm infra:up                 # postgres + redis + mailpit  (docker/compose.yaml)
pnpm db:migrate               # apply src/server/db/migrations
pnpm db:seed                  # categories + demo listings
pnpm dev                      # http://localhost:3000
pnpm worker:dev               # heartbeat worker (separate terminal)
```

Verify: `curl localhost:3000/healthz` → `ok`; `curl localhost:3000/readyz` →
`{"status":"ready","db":"ok","redis":"ok"}`; the home page lists the seed rows.

Checks: `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` (build sets
nothing up — add `SKIP_ENV_VALIDATION=1` if you have no `.env`).

## Bump dependency majors (deliberately)

Resolved versions are conservative (Next 15, Biome 1, Zod 3, next-intl 3).
Newer majors exist (Next 16, Biome 2, Zod 4, next-intl 4). Bump one at a time
with its codemod/migration guide, re-run `pnpm typecheck && pnpm build`.

## Milestone 2 (the core loop)

Build `modules/bids` (ledger, threshold, **fulfilment transaction**),
`modules/payments` (checkout, settlement), the Stripe adapter + webhook route,
`/claim`, `/go/[slug]`, and board caching (ADR-0009). Test to the Tier-1 bar in
[ADR-0014](docs/adr/0014-testing-strategy.md) — idempotency, concurrency,
partial failure — plus the `k6` load test, in the same milestone.

## Known follow-ups

- **Worker image size**: the Dockerfile ships full `node_modules` for the
  worker (bullmq isn't traced into the Next standalone output). Slim to prod
  deps once size matters.
- **Import boundaries**: `biome.json` restricts a few vendor imports by path;
  add `dependency-cruiser` for the full `app → modules → server → lib` rule.
- **i18n routing**: no `/en` URL prefix yet — revisit if SEO needs it.
- `playwright.config.ts` + `src/test/**` factories land with Milestone 2.
