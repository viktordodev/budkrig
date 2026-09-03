# Architecture Decision Records

An ADR captures **one** significant, hard‑to‑reverse decision: the context that
forced it, what we chose, and what we give up. It is a dated snapshot — we do
not edit the reasoning after the fact. If a decision changes, we add a new ADR
that supersedes the old one and update the old one's status line.

We write an ADR when a choice:

- is expensive to undo (datastore, money model, hosting, payment provider), or
- constrains many future changes (module boundaries, auth model), or
- someone will predictably ask "why on earth did they do it *that* way".

We do **not** write one for reversible, local choices (a library swap, a
folder rename) — those live in the PR.

Format: a trimmed [MADR](https://adr.github.io/madr/). Copy
[`0000-template.md`](0000-template.md).

Status values: `Proposed` → `Accepted` → (`Superseded by 00XX` | `Deprecated`).

## Index

| # | Title | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](0002-nextjs-app-router-single-app.md) | Next.js App Router, one deployable app, Server Actions for mutations | Accepted |
| [0003](0003-postgres-with-drizzle.md) | PostgreSQL with Drizzle ORM | Accepted |
| [0004](0004-money-as-integer-ore-and-bid-ledger.md) | Money as integer öre; append‑only bid ledger; SEK only | Accepted |
| [0005](0005-rank-semantics-and-concurrency.md) | Rank semantics and concurrency model | Accepted |
| [0006](0006-stripe-hosted-checkout.md) | Stripe hosted Checkout for one‑time payments | Accepted |
| [0007](0007-swedish-payments-tax-consumer-law.md) | Swedish payment methods, VAT/invoicing, consumer‑law checkout | Accepted |
| [0008](0008-optional-accounts-email-ownership.md) | No mandatory accounts; email‑based listing ownership | Accepted |
| [0009](0009-realtime-revalidation-polling-sse.md) | Near‑real‑time via revalidation + polling + SSE; defer websockets | Accepted |
| [0010](0010-redis-bullmq-for-async-work.md) | Redis + BullMQ for async work and cron | Accepted |
| [0011](0011-self-hosted-deployment-on-coolify.md) | Self‑hosted deployment on Coolify, single VPS, vertical scaling | Accepted |
| [0012](0012-content-moderation-and-abuse.md) | Content moderation and abuse handling | Accepted |
| [0013](0013-observability-and-analytics.md) | Observability and privacy‑friendly analytics stack | Accepted |
| [0014](0014-testing-strategy.md) | Testing strategy | Accepted |
| [0015](0015-pre-launch-legal-compliance-gate.md) | Pre‑launch legal & compliance gate | Proposed |
