# Runbook — Coolify setup (Milestone 1)

Goal: `main` deploys to a `production` (and later `preview`) Coolify project as
a **web** service + a **worker** service, backed by **Postgres** + **Redis**,
with migrations run before each release. Topology: see
[`../architecture/infrastructure.md`](../architecture/infrastructure.md).

## 1. Project + databases

1. Create a Coolify **project** `budkrig`, environment `production`.
2. Add a **PostgreSQL 16** service. Note its internal connection string
   (`postgres://…@<service>:5432/…`).
3. Add a **Redis 7** service (enable persistence / AOF). Note
   `redis://…@<service>:6379`.
4. Neither database is exposed publicly — apps reach them on Coolify's private
   network.

## 2. Web service

- **Source:** GitHub repo `viktordodev/budkrig`, branch `main`.
- **Build pack:** `Dockerfile`. Location `/Dockerfile` (repo root — the default).
- **Port:** `3000`.
- **Health check path:** `/healthz` (liveness). Use `/readyz` once the DB/Redis
  env is set and you want deploys gated on dependencies being reachable.
- **Pre-deploy command:**
  `node_modules/.bin/drizzle-kit migrate`
  (forward-only, expand/contract migrations — a bad migration fails the deploy
  instead of crash-looping; see conventions).
- **Start command:** leave default (`node server.js`).

### Web env vars (Coolify → the service → Environment Variables)

Required:

| Key | Value |
| --- | --- |
| `APP_URL` | `https://<your-domain>` (no trailing slash) |
| `APP_ENV` | `production` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the Postgres service connection string |
| `REDIS_URL` | the Redis service connection string |
| `LISTING_MANAGEMENT_JWT_SECRET` | a fresh random string ≥ 32 chars |
| `IP_HASH_SALT` | a fresh random string ≥ 16 chars |

Recommended now, required later:

| Key | Notes |
| --- | --- |
| `DATABASE_MIGRATION_URL` | elevated role for migrations (ADR-0003); falls back to `DATABASE_URL` |
| `SENTRY_DSN` | once a GlitchTip/Sentry instance exists (ADR-0013) |
| `EMAIL_*`, `STRIPE_*`, `S3_*` | Milestones 2–3 |

Do **not** set `SKIP_ENV_VALIDATION` at runtime — the image already sets it for
the build only; runtime must validate.

## 3. Worker service

Add a **second resource in the same project** from the same repo/branch/
Dockerfile, then:

- **Start command:** `node dist/workers/main.js`
- **Port / health check:** none (it's not an HTTP server).
- **Pre-deploy command:** none (the web service runs migrations).
- **Env vars:** at least `APP_ENV`, `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`
  (same values as web).

Coolify will build the image twice (once per service) until we add a registry;
that's fine for now.

## 4. Deploy trigger from CI

The `deploy` job in `.github/workflows/ci.yml` POSTs to a Coolify webhook on
push to `main`, but no-ops if the secret is absent. To enable it:

1. Coolify → web service → **Webhooks** → copy the deploy webhook URL, and
   generate an API token.
2. GitHub repo → Settings → Secrets and variables → Actions:
   - `COOLIFY_DEPLOY_WEBHOOK` = the URL
   - `COOLIFY_TOKEN` = the token

Until then, Coolify's own GitHub integration (auto-deploy on push) is fine.

## 5. First deploy checklist

- [ ] Postgres + Redis services healthy.
- [ ] Web env vars set (table above).
- [ ] Deploy the **web** service. Pre-deploy runs `drizzle-kit migrate` — check
      the deploy log shows the `0000_*` migration applied.
- [ ] `curl https://<domain>/healthz` → `{"status":"ok",…}`.
- [ ] `curl https://<domain>/readyz` → `{"status":"ready","db":"ok","redis":"ok"}`.
      A `503` here means `DATABASE_URL` / `REDIS_URL` are wrong or the services
      aren't linked.
- [ ] Run the seed once (one-off): in the web container,
      `node --import tsx src/server/db/seed.ts` is **not** available (no tsx in
      the runtime image) — instead seed from your machine against the prod DB
      with `DATABASE_URL=… pnpm db:seed`, or add a temporary one-off command.
      The board should then show the demo rows.
- [ ] Deploy the **worker** service. Its log shows `worker started` and a
      `heartbeat` line each minute.
- [ ] Point a domain at the web service; Coolify provisions TLS via Traefik.

## 6. Still outstanding for Milestone 1

- Error tracking (`SENTRY_DSN`).
- Uptime monitor on a **separate** host hitting `/healthz`.
- Postgres backups + a **restored** rehearsal → `restore.md` (write it next).
- A `preview` project mirroring this, Stripe in test mode (Milestone 2).
