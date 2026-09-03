# `modules/` — the domain

Framework-agnostic feature domains. Each module exposes a public `index.ts` and
keeps its internals private. Business rules and invariants live here, not in
`app/` or `server/`.

Planned modules:

| Module | Owns | Key files (to build) |
| --- | --- | --- |
| `listings/` | Board read models, listing lifecycle (`draft → pending_payment → active ⇄ hidden → removed`), slug derivation, position query | `board.ts`, `listing.ts`, `slug.ts`, `ports.ts` |
| `bids/` | The append-only ledger, threshold rule (ADR-0005), **fulfilment transaction** (ADR-0004, core-flows Flow 1b), ledger replay + assertion | `ledger.ts`, `threshold.ts`, `fulfil.ts`, `reconcile.ts`, `ports.ts` |
| `payments/` | Provider-agnostic orchestration: start a checkout for a bid, interpret a settlement event, VAT/tax mode mapping, invoice numbering | `checkout.ts`, `settlement.ts`, `tax.ts`, `ports.ts` |
| `moderation/` | Pre-publish auto-checks, operator queue actions, denylist, reports (ADR-0012) | `checks.ts`, `queue.ts`, `denylist.ts`, `ports.ts` |
| `activity/` | The `pulse` payload (top-N, viewer position, activity tail, counters), presence (post-v1) (ADR-0009) | `pulse.ts`, `presence.ts`, `ports.ts` |

**Ports** (interfaces the module needs) are declared in each module's
`ports.ts`; **adapters** live in `server/` and are injected at the composition
root (`app/`, `workers/`). Example: `bids` declares a `ListingRepository` port;
`server/db` implements it.
