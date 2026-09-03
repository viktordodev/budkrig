# Engineering Guidelines

How we write code in this repo. Short, enforced where possible by tooling
(`biome`, `tsc`, CI). If a rule here fights a rule in an ADR, the ADR wins and
this doc gets fixed.

## Language & types

- **TypeScript `strict`**, plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`. No `any` — use `unknown` and narrow. `// @ts-expect-error`
  needs a comment saying why.
- **Validate at every boundary** with Zod: form input, Server Action args,
  route params, webhook payloads, job payloads, `process.env`. Inside the
  boundary, trust the types.
- **Brand domain primitives**: `Ore`, `ListingId`, `Slug` are branded types,
  not bare `number`/`string`. Money never travels as `number`.
- Prefer discriminated unions + exhaustive `switch` over booleans and optional
  soup. `assertNever` in the default case.
- Errors: domain functions return a typed `Result<T, E>` for *expected* failure
  (threshold not met, listing not found). `throw` only for *bugs* and
  truly‑exceptional infra failure. Server Actions return a typed result object,
  never a thrown string to the client.

## Project structure

```
src/
  app/            Next.js App Router. Routes only. Thin. No business logic.
  modules/        Feature domains. The core. Framework-agnostic.
    listings/     board queries, listing lifecycle
    bids/         ledger, thresholds, fulfilment
    payments/     provider-agnostic payment orchestration
    moderation/   checks, queue, actions
    activity/     pulse feed, counters
  server/         Cross-cutting infra adapters.
    db/           drizzle schema, client, migrations, repositories
    payments/     Stripe adapter implementing modules/payments ports
    queue/        BullMQ setup, job registry
    email/        provider adapter + templates
    redis/        client, cache helpers, rate limiter
    auth/         manage-link token helpers
    config/       env parsing (Zod), typed config object
    observability/ logger, request-id, otel, health
  lib/            Pure, dependency-free utilities. money, slug, url, format, result.
  components/     Shared React (mostly server components; client ones are leaf-level).
  workers/        Worker entrypoint + processors. Imports modules/ + server/.
  test/           Factories, fixtures, Testcontainers helpers.
```

### Dependency rule (enforced by an import‑boundary lint rule)

```
app/  ─▶ modules/ ─▶ server/ ─▶ lib/
components/ ─▶ modules/ (read models only), lib/
workers/ ─▶ modules/ ─▶ server/ ─▶ lib/
```

- `lib/` imports nothing from the app. Pure.
- `modules/` contain domain logic and define **ports** (interfaces); `server/`
  provides the **adapters**. A module never imports `stripe`, `ioredis`, or
  `next` directly.
- `app/` and `workers/` are the only places that wire adapters to modules
  (composition root per entrypoint).
- No `modules/x` importing `modules/y` internals — go through y's public
  `index.ts`.

## Data & money

- All money is `Ore` (integer). Format only in components via `formatKr()`.
  Lint rule bans template‑literal interpolation of anything typed `Ore`.
- Every DB write on the money path is inside a transaction. Fulfilment locks the
  listing row (`FOR UPDATE`). See ADR‑0005 / core‑flows.
- Repositories (`server/db/repositories`) return domain types, not Drizzle row
  shapes. SQL stays in the repository layer.
- Migrations: generated SQL, committed, reviewed. **Expand/contract only** —
  every migration is backward‑compatible with the currently‑running release
  (add nullable column → backfill → make non‑null in a later deploy; never
  rename in place). No destructive change without a prior deploy that stopped
  using the thing.

## Next.js specifics

- Server Components by default. `"use client"` only on interactive leaves; push
  it as far down the tree as possible.
- No business logic in `app/**` — a route/action is an adapter: parse input,
  call a module, map the result to a response/redirect.
- Caching is explicit and commented: every `fetch`/DB read in a cached route
  states its revalidation strategy. Fulfilment does targeted revalidation (ADR‑0009).
- `generateMetadata` + JSON‑LD on every public page. Sitemap + `robots` are
  generated.
- Never build a redirect target from user input. `/go/[slug]` looks the slug
  up; it never reflects a query param.

## Security

- Secrets only via `server/config/env.ts` (Zod‑parsed `process.env`), only in
  `server/`/`workers/`. A secret in a `"use client"` module is a CI failure.
- Every mutation: authn/authz check + rate limit (Redis) + input validation.
- Webhooks verify the signature against the **raw** body before parsing.
- Manage‑link tokens: short TTL, single‑listing scope, server‑only signing key.
- `owner_email` and IP hashes are the only PII; never log them raw. IPs are
  salted‑hashed at the edge.
- Output: outbound links `rel="nofollow ugc sponsored"`,
  `referrerpolicy="no-referrer"`. CSP configured, no inline scripts.

## Performance

- The board renders from one query + cache. No per‑item queries, ever.
- Keyset (cursor) pagination, not `OFFSET`.
- Cap the DB connection pool so a spike can't exhaust Postgres (N4).
- Client JS budget: the board page ships minimal JS; the claim widget is the
  only meaningful client component.

## Accessibility & i18n

- Swedish (`sv`) is the default locale; copy lives in message catalogs
  (`next-intl`), never hard‑coded in components. English (`en`) is a secondary
  catalog.
- Semantic HTML, labelled controls, visible focus, keyboard‑operable stepper,
  `prefers-color-scheme` respected (dark mode is a product feature).
- Money/number/date formatting via `Intl` with the active locale.

## Comments & naming

- Match the surrounding code. Comment the *why*, not the *what*.
- Name things in the ubiquitous language (`domain-model.md`): `listing`, `bid`,
  `delta`, `resulting`, `floor`, `claim`, `raise`. Not `item`, `order`, `price`.
- Files: `kebab-case.ts`. React components: `PascalCase.tsx`. One primary export
  per file where reasonable.

## Dependencies

- Bias to boring, well‑maintained, few‑transitive‑deps libraries. A new runtime
  dependency needs a one‑line justification in the PR.
- Pin with a lockfile; renovate/dependabot for updates; CI must pass to merge.
- No dependency whose job we could do in 20 lines in `lib/`.
