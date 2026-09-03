<!-- Keep PRs small (< ~400 lines). See docs/conventions/git-and-reviews.md -->

## What & why

<!-- One or two sentences. Link the issue / ADR. -->

Implements / changes: ADR-____ · Closes #____

## How it was tested

<!-- Risk tier per ADR-0014. Money-path changes need integration + concurrency tests. -->

## Reviewer: look hard at

<!-- The one or two things most likely to be wrong. -->

## Checklist

- [ ] `typecheck` / `lint` / `test` / `build` / `e2e` green
- [ ] Tests match the risk tier (ADR-0014)
- [ ] Boundaries respected — `modules/` free of vendor/framework imports
- [ ] Money path (if touched): transactional · idempotent · integer öre · constraint-backed
- [ ] Migration (if any) is expand/contract & backward-compatible with the running release
- [ ] New env vars in `.env.example` + Coolify
- [ ] User-facing copy in `sv` + `en` catalogs
- [ ] New failure modes have a log line / metric / alert
- [ ] Docs updated (ADR / brief / domain-model / core-flows as needed)
