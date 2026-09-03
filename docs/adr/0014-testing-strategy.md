# 0014 — Testing strategy

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

The risk is concentrated: the money path (N1, N3) and the spike‑time read path
(N4). Most of the app (rendering a sorted list) is low‑risk. A solo team can't
afford a giant slow test suite, but also can't afford a money bug. Test effort
should be spent where a defect is expensive.

## Decision

**Test by risk tier, not by uniform coverage.**

### Tier 1 — the money path: exhaustive

- **Unit / property tests** (`vitest`, fast‑check) for `src/lib/money.ts`
  (öre arithmetic, formatting, no float leak) and the ledger/threshold logic
  in `src/modules/bids` — including property tests that *replaying any ledger*
  reproduces `current_amount_ore` (ADR‑0004 invariant).
- **Integration tests** (`vitest` + a real Postgres via Testcontainers) for
  fulfilment: idempotency on repeated Stripe events, unique‑constraint
  behaviour (one payment per bid), `FOR UPDATE` serialisation, threshold
  re‑validation, partial‑failure rollback (core‑flows §matrix).
- **Concurrency tests**: N parallel claims on one listing and across listings,
  assert no double‑spend, no drift, correct final ranking.
- **Stripe webhook contract tests**: fixture events (`stripe fixtures` /
  `stripe-mock`) → assert exact DB state; signature verification against raw
  body; replay + out‑of‑order delivery.

### Tier 2 — critical user journeys: a few real E2E

- **Playwright** against the full stack in Docker with **Stripe test mode**:
  browse board → claim a rank → (test card) → webhook (via `stripe listen` or a
  forwarded endpoint) → listing appears ranked → receipt email caught in
  Mailpit → manage link edits copy.
- The "floor moved" path, the Swish "pending then settles" path, an abandoned
  checkout.
- One E2E for the moderation queue (flag → hide → gone from board).

### Tier 3 — everything else: light

- Component tests only for genuinely tricky UI (the claim widget's live
  position / stepper). Render‑only smoke tests for pages.
- Lean on TypeScript + Zod at the edges instead of tests for plumbing.

### Non‑functional

- **Load test** (`k6`) as a Milestone‑2 deliverable: 5k concurrent board
  readers + a stream of concurrent claims; assert p95 latency (N2), flat DB
  query rate (N4), and ledger integrity after the run (N1). Re‑run before
  launch.
- **Restore rehearsal** (ADR‑0011) is a test: automated daily, asserts row
  counts + invariants on the restored DB.

### CI gates (block merge)

`typecheck` · `lint` (Biome) · `unit + integration` (Testcontainers) ·
`build` · `e2e` (Playwright). Load test runs nightly + on demand, not per‑PR.

## Consequences

### Positive
- Effort lands on the ~15% of code where a bug costs real money or reputation.
- Concurrency + idempotency are proven, not hoped.
- Fast per‑PR suite (Tier 1 unit + a thin E2E); the slow stuff is nightly.

### Negative / accepted trade‑offs
- Lower line coverage on UI/plumbing — deliberate. A missed cosmetic bug is
  cheap; a missed double‑charge is not.
- Testcontainers + Playwright make CI heavier than pure unit tests. Worth it;
  the money path *must* be tested against real Postgres and real Stripe events.
- Load test infra is extra setup. It's also the single best defence for R3.

### Follow‑ups
- `vitest.config.ts`, Testcontainers Postgres helper, Stripe fixture set.
- `playwright.config.ts` + a `docker compose` test profile with Mailpit.
- `k6` script + a target environment (preview) + a results baseline.
- Seed + factory helpers (`src/test/factories`).
- CI workflow (`.github/workflows/ci.yml`) with the gates above.

## Alternatives considered

- **Uniform 80% coverage target** — spends effort on trivial code, creates
  brittle tests, and still lets a subtle concurrency bug through. Rejected.
- **Mock the database everywhere** — the bugs we fear (locking, constraints,
  transactions) only exist against real Postgres. Mocks would hide them.
- **Only manual testing** — impossible to safely test concurrent claims or
  webhook replay by hand; regressions on the money path would be routine.
- **Contract testing via Pact** — overkill; Stripe's fixtures + `stripe-mock`
  cover the one external contract we depend on.
