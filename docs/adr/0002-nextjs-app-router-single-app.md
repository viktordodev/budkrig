# 0002 — Next.js App Router, one deployable app, Server Actions for mutations

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

Constraint from the founder: the app is Next.js, self‑hosted on Coolify. The
product is read‑heavy (a public leaderboard, N2/N4) with a small, correctness‑
critical write path (claim a rank, N1/N3) and a strong SEO requirement (G5 —
every listing is an indexable page). The reference product (outbid.lol) is
built on the same family of stack (Next.js, `supastarter`).

## Decision

- **Next.js with the App Router**, React Server Components by default. The
  board and listing pages are Server Components rendered from the DB/cache with
  HTTP caching headers (`s-maxage`, `stale-while-revalidate`).
- **`output: "standalone"`** — produces a self‑contained `node server.js` we
  run in a container (ADR‑0011). No serverless, no edge runtime.
- **Mutations go through Server Actions** (`"use server"`), not a parallel REST
  API. One exception: **inbound webhooks are Route Handlers** under
  `app/api/webhooks/*` because they need the raw request body and a stable
  external URL.
- **One deployable app.** No separate API service, no BFF, no GraphQL gateway.
  Domain logic lives in framework‑agnostic modules under `src/modules/*` and
  `src/server/*`, called by both Server Actions and the worker — so "no
  separate service" does not mean "no separation of concerns".
- Outbound redirect + click counting is a tiny Route Handler (`app/go/[slug]`).

## Consequences

### Positive
- Minimal moving parts for a solo operator (G6). One image, one framework.
- RSC + HTTP caching gives the spike‑resistant read path almost for free (N4).
- Server Actions keep the mutation surface small, typed end‑to‑end, and
  co‑located with the UI; no client‑side API client to maintain.
- SEO is first‑class: real SSR/SSG, `generateMetadata`, sitemap, JSON‑LD.

### Negative / accepted trade‑offs
- Server Actions are Next‑specific; a future non‑web client (native app,
  partner API) would need a real API layer added. Acceptable — it's a non‑goal,
  and the domain modules are already the seam to expose.
- App Router + RSC + caching has sharp edges (caching semantics, `"use client"`
  boundaries). Mitigated by conventions and keeping client components leaf‑level.
- Long‑running Node server (not serverless) means we own process management,
  memory, and graceful shutdown — handled by Coolify + health checks.

### Follow‑ups
- `next.config.ts`: `output: "standalone"`, explicit `cacheHandler` later if we
  move cache to Redis cluster.
- Convention: no business logic in `app/**`; routes are thin adapters.
- Define the Server Action error contract (typed result, not thrown strings).

## Alternatives considered

- **Next.js + tRPC / dedicated REST** — more ceremony, a client to keep in
  sync, no benefit while the only consumer is our own web UI.
- **Remix / TanStack Start** — fine choices, but the founder fixed Next.js and
  the reference implementation is Next.js.
- **Split web + API services** — operational cost (two deploys, a network hop,
  auth between them) with no v1 payoff. Revisit only if a second client appears.
- **Serverless (Vercel / OpenNext on Lambda)** — conflicts with the self‑hosted
  Coolify constraint and complicates the always‑on worker + websocket/SSE path.
