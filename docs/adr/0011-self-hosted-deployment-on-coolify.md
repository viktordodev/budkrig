# 0011 — Self‑hosted deployment on Coolify, single VPS, vertical scaling

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

Founder constraint: self‑hosted on **Coolify**. Reasons that fit the product:
EU data residency for GDPR (N8, R9), predictable flat cost, no vendor lock‑in,
and the operator already knows the model. The workload is a cache‑served read
path + a light write path + one worker + Postgres + Redis. Traffic is spiky but
the spike is almost all reads, which are cached.

## Decision

- **Coolify on a single EU VPS.** One Coolify project, four services: `web`,
  `worker`, `postgres:16`, `redis:7`. Postgres and Redis are Coolify managed
  services on the same host, reachable only on the private network.
- **Deploy from a `Dockerfile`** (not Nixpacks) — multi‑stage, `next build`
  with `output: "standalone"`, distroless/slim runtime, non‑root, one image for
  both `web` and `worker` (ADR‑0002, ADR‑0010).
- **CI gates, then Coolify deploys on push to `main`** via its deploy webhook,
  triggered by a GitHub Actions job only after typecheck + lint + unit + e2e +
  build pass.
- **Migrations run as a pre‑deploy release step** (`drizzle-kit migrate`), so a
  bad migration fails the deploy instead of crash‑looping. Migrations are
  forward‑only, expand/contract, backward‑compatible with the previous release
  (conventions).
- **Rolling restart** with `/healthz` (liveness) + `/readyz` (DB + Redis
  reachable) health checks; Coolify keeps the previous container for rollback.
- **TLS** via Coolify's Traefik + Let's Encrypt.
- **Secrets** in Coolify's encrypted per‑service env, never in the repo.
- **Backups**: Postgres WAL archiving + nightly encrypted dump to **offsite**
  object storage (different provider), 30‑day + 6‑monthly retention, with a
  daily automated **restore rehearsal** into a scratch DB (N6,
  `infrastructure.md`).
- **Scaling plan is vertical**: resize the VPS. Horizontal (multiple `web`
  containers behind Traefik, then a separate DB host, then read replicas) only
  when load tests or production metrics prove one box can't cope.

Chosen VPS provider/region is Open question Q6 (Hetzner DE/FI vs a Swedish host).

## Consequences

### Positive
- EU‑only data, one bill, no lock‑in (N8, R9), operator familiarity (G6).
- One image, one deploy pipeline, one host to reason about.
- Coolify gives managed Postgres/Redis, TLS, health checks, log access and
  rollback without us scripting them.
- Vertical scaling on modern VPS goes a very long way for this workload.

### Negative / accepted trade‑offs
- **Single point of failure** (R7): host, disk, or Coolify itself. Mitigated by
  offsite rehearsed backups, infra‑as‑config for fast rebuild, and disk/DB
  alerts. Explicitly accepted for v1.
- We own OS patching, Coolify upgrades, Postgres tuning, and the backup
  pipeline. Bounded and documented in runbooks.
- No global edge/CDN by default → non‑SE latency is worse. Fine for a
  Sweden‑first product; can front with a CDN later.
- Deploy = brief rolling restart. Health checks keep it invisible; blue/green
  only if that stops being true.

### Follow‑ups
- `docker/Dockerfile`, `docker/compose.yaml` (local parity), `.github/workflows/ci.yml`.
- `/healthz` + `/readyz` route handlers.
- Coolify: two projects (`preview`, `production`), webhook deploy, pre‑deploy
  migrate command, resource limits, log drain.
- Backup + **restore runbook** (`docs/runbooks/restore.md`) — Milestone 1 exit
  criterion.
- Decide Q6 (host/region) before Milestone 1.
- Document the "resize the VPS during a spike" runbook.

## Alternatives considered

- **Vercel / Netlify** — great DX, but conflicts with the self‑hosted
  constraint, complicates the always‑on worker + SSE, and is a US‑centric data
  path (R9).
- **Nixpacks instead of a Dockerfile** — faster to start, but we want explicit
  control over the runtime image, the standalone output, and the shared
  web/worker entrypoints.
- **Docker Compose by hand / Dokku / CapRover** — Coolify is the founder's
  choice and gives more of the managed‑service + UI niceties out of the box.
- **Kubernetes (k3s)** — vastly more operational surface than a solo product
  needs. No.
- **Managed Postgres (Neon/RDS/Crunchy) + Coolify app** — removes the DB SPOF
  and backup burden, at the cost of a subprocessor and a data‑residency check.
  Reasonable future move if backup rehearsals or on‑call become painful;
  recorded here as the first escape hatch.
