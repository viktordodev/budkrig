# Git Workflow & Code Review

## Branching

- **Trunk‑based.** `main` is always deployable and always green.
- Short‑lived branches: `feat/board-pagination`, `fix/webhook-signature`,
  `chore/bump-next`. Merge within a day or two; if it's bigger, ship it behind a
  flag in pieces.
- No long‑running `develop`/`release` branches. `preview` env deploys from a
  branch or on demand, not from a permanent branch.

## Commits

- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `test:`, `perf:`, `build:`, `ci:`. Scope optional: `feat(bids): …`.
- Imperative mood, present tense. Body explains *why* when it isn't obvious.
- Reference the ADR when a commit implements or changes one:
  `feat(payments): webhook-driven fulfilment (ADR-0006)`.
- History on `main` is linear (squash or rebase merge). One logical change per
  commit.

## Pull requests

- Small. < ~400 lines of diff is the target; if you can't, split it.
- The PR description states: what, why, which ADR/issue, how it was tested, and
  anything the reviewer should look hard at.
- Screenshots/screencast for UI changes.
- Draft PRs early for direction checks.
- Even solo: **open a PR, let CI run, read your own diff top to bottom before
  merging.** The PR is the design record.

## Review checklist

Correctness
- [ ] Money path: inside a transaction? idempotent? integer öre only?
      constraint‑backed (one payment per bid)?
- [ ] Input validated at the boundary (Zod)? Errors typed, not thrown to client?
- [ ] Concurrency: any new shared state? does it need `FOR UPDATE`?
- [ ] Migration is expand/contract and backward‑compatible with the running
      release?

Boundaries
- [ ] `modules/` free of framework/vendor imports? dependency rule respected?
- [ ] No business logic leaked into `app/**`?
- [ ] Secrets only in `server/`/`workers/`, never in a client component?

Product / UX
- [ ] Copy in the message catalog (`sv` + `en`), not hard‑coded?
- [ ] Cached route: revalidation strategy stated and correct?
- [ ] Outbound links: `nofollow ugc sponsored`, no open redirect?
- [ ] Accessible: labels, keyboard, focus, dark mode?

Ops
- [ ] New failure mode → is there a log line / metric / alert for it?
- [ ] New env var → in `.env.example` and documented?
- [ ] Tests match the risk tier (ADR‑0014)? Money path has integration +
      concurrency tests?

## CI gates (must pass to merge)

`typecheck` → `lint` (Biome) → `unit + integration` (Testcontainers) →
`build` → `e2e` (Playwright, Stripe test mode).

Nightly / on‑demand: `k6` load test, `restore-rehearsal`, dependency audit.

## Deploys

- Merge to `main` → CI green → Coolify deploy webhook fires (ADR‑0011).
- Migrations run as the pre‑deploy release step.
- Watch error rate + webhook lag for 10 minutes after a money‑path deploy.
- Rollback = redeploy the previous image in Coolify; DB fixes are forward
  migrations only.

## Versioning

No semver / releases for the app itself (it's a hosted product). Tag notable
deploys (`deploy-2026-09-14`) if useful for correlation. `CHANGELOG.md` is
optional; the compliance‑relevant changes go in `docs/compliance/`.
