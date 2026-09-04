# Budkrig — build status & handoff

_Last updated: 2026‑09‑04 · after PR #12 · `main` @ `3b172a2`_

The single page to drive from. What's built, what's deployed, every env var,
and exactly what's left — by owner.

---

## 1. What it is

A Swedish‑market clone of [outbid.lol](https://outbid.lol): a public
**pay‑to‑rank leaderboard**. You pay to put a URL or `@handle` on the board;
rank = cumulative amount paid; payments are non‑refundable; nothing expires.
It's a payments product with a money ledger, a spike‑resistant read path, and
adversarial content from day one — see
[`architecture/00-overview.md`](architecture/00-overview.md).

## 2. Deployed now

**https://budkrig.viktordo.dev** (Coolify, single EU VPS).

Working: the board renders from Postgres, `/claim` form (all fields + EU consent
+ links to `/terms`/`/privacy`), `/go/{slug}` redirect, `/foretagsinformation`
`/terms` `/privacy`, `/healthz` + `/readyz` (both green — DB + Redis wired),
migrations `0000`–`0003` applied, categories seeded.

**Not yet functional on the deploy:** taking a payment — needs Stripe keys +
webhook endpoint (see §5). The worker service and its cron also need to be
running (see §5).

## 3. What was built — 12 PRs

| # | | |
|---|---|---|
| — | prep | architecture brief, 15 ADRs, conventions, risk register, scaffold |
| 1 | M1 | Next.js App Router shell, health checks, DB client, board, worker, CI |
| 2–3 | deploy | Dockerfile at root, bundled `migrate`/`seed` entrypoints |
| 4 | M2 | ledger core — amount rule, replay, rank derivation |
| 5–6 | M2 | fulfilment decision + **transaction** (concurrency‑proven, 10 integration tests) |
| 7 | M2 | claim transaction, Stripe adapter, webhook route |
| 8 | M2 | `/claim` UI + Server Action, `/go/{slug}`, board caching (ISR + Redis) |
| 9 | M2 | BullMQ async fulfilment + `expire-pending`/`assert-ledger`/`reconcile-stripe` cron |
| 10 | M2 | k6 load tests (board spike + settlement burst + ledger assertion) |
| 11 | M3 | Swish/Klarna + Stripe Tax + VAT capture |
| 12 | M3 | legal pages + `docs/compliance/launch-gate.md` |

~92 tests (unit + property + Testcontainers integration), all CI‑gated. CI:
`typecheck · lint · test · build · standalone /healthz smoke · integration
(Testcontainers Postgres) · docker image`. Nightly: `load.yml`.

## 4. Architecture at a glance

- **Stack:** Next.js (App Router, `output: standalone`) · Postgres + Drizzle ·
  Redis + BullMQ · Stripe hosted Checkout · Tailwind + next‑intl · self‑hosted
  on Coolify. One image, two roles (`web` = `node server.js`, `worker` =
  `node dist/workers/main.js`).
- **The money model** (ADR‑0004 / ADR‑0005): integer öre, append‑only `bids`
  ledger, `listings.current_amount_ore` is a derived cache. Rank is *computed*,
  not stored: `ORDER BY current_amount_ore DESC, first_active_at ASC, id ASC`.
- **The fulfilment transaction** (core‑flows Flow 1b): webhook verifies +
  enqueues → worker, in one tx: record webhook event (idempotency) → claim the
  bid by stamping `provider_payment_intent` → **atomic `UPDATE listings SET
  current_amount_ore = current_amount_ore + delta … RETURNING`** → flip bid to
  settled with the ledger amounts. Idempotent on the Stripe event id **and** on
  bid + payment_intent.
- **Code layout:** `app/` (thin routes) → `modules/bids` (pure domain: threshold,
  ledger, rank, `decideFulfilment`, `planClaim`) → `server/` (adapters: db
  repositories, stripe, redis, queue, config) → `lib/` (pure utils). See
  [`../src/README.md`](../src/README.md).
- Full docs: [`architecture/`](architecture/), decision rationale in
  [`adr/`](adr/).

## 5. Environment variables

Parsed + validated by [`../src/server/config/env.ts`](../src/server/config/env.ts).
Set in Coolify per‑service (web **and** worker). `.env.example` is the template.

### Required (web + worker)
| Key | Notes |
|---|---|
| `APP_URL` | `https://budkrig.viktordo.dev`, no trailing slash |
| `APP_ENV` | **set to `production`** (currently isn't — demo listings still show) |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Postgres service connection string |
| `REDIS_URL` | Redis service connection string |
| `LISTING_MANAGEMENT_JWT_SECRET` | random ≥ 32 chars |
| `IP_HASH_SALT` | random ≥ 16 chars |

### To take payments (not set yet)
| Key | Notes |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` then `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | from the Stripe webhook endpoint you create → `POST /api/webhooks/stripe`, events `checkout.session.completed` + `checkout.session.async_payment_succeeded` + `payment_intent.succeeded` |
| `CHECKOUT_PAYMENT_METHODS` | `card` (default). Set `swish,card,klarna` once each is activated on the Stripe account |
| `STRIPE_TAX_ENABLED` | `false` (default). `true` once Stripe Tax is activated |
| `DATABASE_MIGRATION_URL` | elevated role for migrations (ADR‑0003); falls back to `DATABASE_URL` |

### Product rules (defaults are fine)
`NEW_LISTING_MIN_ORE=500` · `MIN_INCREMENT_ORE=100` · `PENDING_BID_TTL_MINUTES=30`
· `CURRENCY=SEK` · `TIMEZONE=Europe/Stockholm`

### Later milestones
`EMAIL_PROVIDER` / `EMAIL_FROM` / `RESEND_API_KEY` (invoices, receipts) ·
`S3_*` (OG images, invoice archive, backups) · `SAFE_BROWSING_API_KEY`
(moderation) · `SENTRY_DSN` / `OTEL_EXPORTER_OTLP_ENDPOINT` / `PLAUSIBLE_DOMAIN`
(observability) · `OPERATOR_ALLOWED_EMAILS` (operator area).

### Coolify service config
- **web:** port `3000`, health check `/healthz`, pre‑deploy
  `node dist/server/db/migrate.js`
- **worker:** start command `node dist/workers/main.js`, no port/health check
- One‑off after first deploy: `node dist/server/db/seed.js`
- Full walkthrough: [`runbooks/coolify-setup.md`](runbooks/coolify-setup.md)

## 6. Running it locally

```bash
pnpm install
cp .env.example .env      # fill JWT secret + IP salt
pnpm infra:up             # postgres + redis + mailpit (needs Docker)
pnpm db:migrate && pnpm db:seed
pnpm dev                  # web on :3000
pnpm worker:dev           # worker (separate terminal)
```

Checks: `pnpm typecheck` · `pnpm lint` · `pnpm test` (unit) ·
`pnpm test:integration` (needs Docker) · `pnpm build`.

_This machine has no Docker, so integration + load tests are CI‑only here._

## 7. What's left

### 7a. On you — external (the launch critical path, ADR‑0015)
Tracked in [`compliance/launch-gate.md`](compliance/launch-gate.md) §0:
1. **Gambling‑law opinion** — Swedish lawyer: is the mechanic *lotteri/spel*
   under Spellagen? Existential. Start now — weeks of lead time.
2. **Consumer‑law review** — withdrawal‑waiver wording + non‑refundable clause
   + checkout pre‑contract info.
3. **Company + VAT registered**, F‑skatt → fill `COMPANY` in
   `src/content/legal.ts`. Also unblocks Stripe *live*.
4. **Stripe** verified as the registered business; tell them the launch spike.

### 7b. On you — config / accounts
- Set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` (test mode) + the webhook
  endpoint → then a real payment works end to end.
- `APP_ENV=production` + delete the 2 demo listings.
- Activate Swish + Klarna + Stripe Tax → flip `CHECKOUT_PAYMENT_METHODS` +
  `STRIPE_TAX_ENABLED`.
- Pick an email provider (Resend/Postmark) + a storage bucket → unblocks the
  invoice slice.
- Add `STRIPE_TEST_SECRET_KEY` + `STRIPE_TEST_WEBHOOK_SECRET` to GitHub secrets
  → unblocks the Playwright e2e.
- Uptime monitor on a **separate** host → `/healthz`.
- Enable Coolify Postgres backups + do one **restored** rehearsal →
  `docs/runbooks/restore.md` (not written).
- Set `SENTRY_DSN` (self‑hosted GlitchTip/Sentry, EU).

### 7c. Code slices remaining
| Slice | Blocked on | Size |
|---|---|---|
| **Invoice PDF** — gap‑free numbered VAT invoice per settlement, 7‑year archive, emailed | email provider + storage bucket | medium |
| **Playwright e2e** — full claim→Checkout→webhook loop in Stripe test mode | GitHub secret | small |
| **M4 — moderation** — pre‑publish auto‑checks, operator queue, denylist, `/report`, dispute handling (ADR‑0012) | nothing | large |
| **Receipts + "you were passed" email** | email provider | small |
| Backlog (post‑launch): SSE activity feed, "online now" presence, daily digest, admin analytics, `/today` + category boards, `/manage` magic‑link page | — | — |

## 8. Top risks (full list: [`architecture/risk-register.md`](architecture/risk-register.md))

1. **R1 — gambling‑law classification.** The one that can stop launch. §7a.1.
2. **R2 — money correctness.** Mitigated: append‑only ledger, integer öre,
   idempotent fulfilment, hourly `assert-ledger`, concurrency tests, k6 +
   post‑run ledger check.
3. **R4/R6 — Stripe disputes / account suspension.** Non‑refundable model +
   chargebacks. Promote Swish (BankID, near‑zero fraud); keep dispute rate low;
   payment layer is behind an adapter for a second PSP.

## 9. Operational notes

- **Deploys:** merge to `main` → CI → (Coolify auto‑deploy, or the `deploy` job
  once `COOLIFY_DEPLOY_WEBHOOK` + `COOLIFY_TOKEN` are GitHub secrets). Migrations
  run as the pre‑deploy step, forward‑only / expand‑contract.
- **Rollback:** redeploy the previous image in Coolify. DB = a new forward
  migration, never a down‑migration.
- **The worker image ships full `node_modules`** (bullmq isn't traced into the
  Next standalone output) — slim to prod deps when image size matters.
- **Global git config on this machine has smart‑quote‑wrapped
  `user.name`/`user.email`** — fix with
  `git config --global user.name "Viktor"` and the matching email.
