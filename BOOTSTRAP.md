# Bootstrap — from this scaffold to a running app

This repo currently holds **prep only**: docs, decisions, conventions, and a
hand-written scaffold (config + `src/` skeleton + a few real files). Nothing is
installed and the app does not build yet. Follow this to stand it up
(≈ Milestone 1 in [`docs/architecture/00-overview.md`](docs/architecture/00-overview.md)).

## 0. Decide the open questions that block M1

From the brief's §11: **Q6** (VPS provider/region) at least. The rest can trail
into M2–M3.

## 1. Prerequisites

- Node 22 (`nvm use`), `corepack enable` (gives pnpm)
- Docker Desktop / Docker Engine
- A Stripe account in **test mode** + the Stripe CLI
- Accounts (can wait): a VPS, Coolify installed on it, an object-storage bucket,
  an email provider

## 2. Install & local infra

```bash
corepack enable
pnpm install                 # writes pnpm-lock.yaml — commit it
cp .env.example .env         # fill in Stripe test keys + secrets
pnpm infra:up                # postgres + redis + mailpit (docker/compose.yaml)
```

> **Versions**: `package.json` pins conservative majors as of 2026-09. Before
> committing the lockfile, check for a newer stable Next.js (16.x may be out)
> and Drizzle, and bump deliberately. Re-run `pnpm typecheck` after.

## 3. Generate the Next.js app shell around the scaffold

The scaffold already defines `next.config.ts`, `tsconfig.json`, `biome.json`,
and `src/` structure. You need the App Router entry files and Tailwind:

```bash
pnpm add -D tailwindcss @tailwindcss/postcss postcss
# create: src/app/[locale]/layout.tsx, src/app/[locale]/page.tsx,
#         src/app/globals.css, postcss.config.mjs, src/server/config/i18n.ts
```

Add **shadcn/ui** (`pnpm dlx shadcn@latest init`) and **next-intl** message
catalogs (`messages/sv.json`, `messages/en.json`) — see ADR-0002 and the
engineering guidelines. Keep `src/app/**` thin.

## 4. Database

```bash
# author the first migration from src/server/db/schema.ts
pnpm db:generate
pnpm db:migrate
pnpm db:seed                  # categories + one demo listing (write src/server/db/seed.ts)
```

Also add, in the first migration or a follow-up:
`CREATE SEQUENCE invoice_number_seq;` (ADR-0007).

Write `src/server/db/client.ts` — a pooled `postgres` client with
`drizzle(sql, { schema, casing: "snake_case" })` and `DATABASE_POOL_MAX`.

## 5. Wire the walking skeleton (M1 exit criteria)

- [ ] `GET /healthz` (liveness) and `GET /readyz` (DB + Redis reachable)
- [ ] Home route renders the seeded listing **from the DB**
- [ ] `pino` logger + request-id middleware; `console.log` banned by lint
- [ ] Error tracking (GlitchTip/Sentry) receiving events
- [ ] `src/workers/main.ts` boots a BullMQ worker with one trivial repeatable job
- [ ] Dockerfile builds locally: `docker compose -f docker/compose.yaml --profile app up`
- [ ] CI green on a PR (`.github/workflows/ci.yml`)
- [ ] Coolify: two projects (preview, production), Postgres + Redis services,
      the deploy webhook wired to CI, **migrations as a pre-deploy command**
- [ ] Deployed to preview through CI
- [ ] Uptime monitor (on a *different* host) hitting `/healthz`
- [ ] **Backup + restore rehearsal performed once by hand**, then automated;
      write `docs/runbooks/restore.md`

## 6. Then: Milestone 2 (the core loop)

Build `modules/bids` (ledger, threshold, fulfilment), `modules/payments`
(checkout, settlement), the Stripe adapter + webhook route, and the board.
Test to the Tier-1 bar in [ADR-0014](docs/adr/0014-testing-strategy.md) —
idempotency, concurrency, partial failure — and write the `k6` load test in the
same milestone.

## Worker packaging note

The Dockerfile currently ships `dist/` + full `node_modules` for the worker.
Before M1 ends, decide: bundle the worker with `esbuild` into one file (smaller
image, no `node_modules` in the runner) vs. keep the current approach. Update
`build:worker` and the Dockerfile accordingly.

## House-keeping the scaffold left for you

- `pnpm-lock.yaml` — generate and commit
- `postcss.config.mjs`, `src/app/globals.css`, Tailwind config
- `src/server/config/i18n.ts`, `messages/{sv,en}.json`
- `src/server/db/client.ts`, `src/server/db/seed.ts`
- `vitest.config.ts`, `playwright.config.ts`, `src/test/**`
- `git init` (this is not a git repo yet), first commit, push, protect `main`
- Consider `dependency-cruiser` for stricter import-boundary enforcement than
  `biome.json` can do
