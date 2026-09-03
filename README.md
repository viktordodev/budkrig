# Budkrig

A public **pay‑to‑rank leaderboard** for the Swedish market — a clone of
[outbid.lol](https://outbid.lol) ("budkrig" = *bidding war*).

Anyone can put a product URL or an `@handle` on the board and pay to hold a rank.
Ranking is decided by the amount paid, nothing else. Bids are cumulative and
non‑refundable: to move up you pay the difference over the spot above you, and
the amount you paid becomes the new floor for the next challenger. Nothing
expires.

> This repository currently contains **architecture prep only** — the brief,
> the decision records, the conventions and the scaffold. No application code
> has been written yet. Start at [`docs/architecture/00-overview.md`](docs/architecture/00-overview.md),
> then read [`BOOTSTRAP.md`](BOOTSTRAP.md) to stand the project up.

## Documentation map

| Where | What |
| --- | --- |
| [`docs/architecture/00-overview.md`](docs/architecture/00-overview.md) | The architecture brief: goals, non‑goals, quality attributes, C4 diagrams, roadmap |
| [`docs/architecture/domain-model.md`](docs/architecture/domain-model.md) | Entities, the money model, invariants |
| [`docs/architecture/core-flows.md`](docs/architecture/core-flows.md) | The claim‑rank flow, payment fulfilment, concurrency |
| [`docs/architecture/infrastructure.md`](docs/architecture/infrastructure.md) | Coolify topology, deploy pipeline, backups, environments |
| [`docs/architecture/risk-register.md`](docs/architecture/risk-register.md) | Ranked risks and mitigations |
| [`docs/adr/`](docs/adr/) | Architecture Decision Records (start at `0001`) |
| [`docs/conventions/`](docs/conventions/) | Engineering guidelines, git workflow, definition of done |

## Stack at a glance

Next.js (App Router) · TypeScript · PostgreSQL + Drizzle · Redis + BullMQ ·
Stripe (Swish / Klarna / cards) · Tailwind + shadcn/ui · self‑hosted on
**Coolify**. Rationale for every choice lives in [`docs/adr/`](docs/adr/).
