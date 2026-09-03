# Definition of Done

A change is "done" when **all** of these are true. Not "the code works on my
machine".

## Every change

- [ ] Meets the acceptance criteria in the issue.
- [ ] `typecheck`, `lint`, `unit`, `integration`, `build`, `e2e` all green in CI.
- [ ] Tested at the right risk tier (ADR‑0014). Money path → integration +
      concurrency tests, not just units.
- [ ] Dependency rule + boundaries respected (`engineering-guidelines.md`).
- [ ] New/changed env vars are in `.env.example` and in the Coolify config for
      every env.
- [ ] User‑facing copy is in the `sv` + `en` catalogs.
- [ ] New failure modes have a log line and, if operationally relevant, a
      metric/alert.
- [ ] Docs updated: ADR added/superseded if the decision is significant; the
      brief / domain‑model / core‑flows updated if they now describe reality
      inaccurately.
- [ ] PR reviewed (self‑review at minimum: read the whole diff), description
      complete.
- [ ] Deployed to `preview` and manually sanity‑checked.

## Money‑path change (additionally)

- [ ] All operations in a transaction; listing row locked where required.
- [ ] Idempotent on the external event / idempotency key; replay is a no‑op.
- [ ] Integer öre end to end; no float; display via `formatKr()`.
- [ ] Backed by DB constraints, not just app logic (unique payment↔bid, CHECKs).
- [ ] Concurrency test added/updated; ledger‑replay invariant still holds.
- [ ] Reconciliation + `assert-ledger` jobs still cover the new path.
- [ ] Watched error rate + webhook‑to‑fulfilment lag for 10 min post‑deploy.

## Schema change (additionally)

- [ ] Migration is expand/contract, backward‑compatible with the running
      release.
- [ ] Generated SQL reviewed by a human.
- [ ] Indexes considered for any new query path (especially board/category).
- [ ] `domain-model.md` and `src/server/db/schema.ts` agree.
- [ ] Rollforward plan written if it's risky; no down‑migrations in prod.

## New user‑content surface (additionally)

- [ ] Passes through the moderation checks (ADR‑0012).
- [ ] Outbound links get `rel="nofollow ugc sponsored"`.
- [ ] Rate‑limited.
- [ ] Considered in the GDPR records of processing if it captures PII.

## Milestone exit (additionally)

- [ ] Risk register reviewed and re‑scored.
- [ ] Open questions relevant to the next milestone have answers or owners.
- [ ] For Milestone 1: backup **restore rehearsal** passed.
- [ ] For Milestone 5: every box in ADR‑0015 checked and signed off.
