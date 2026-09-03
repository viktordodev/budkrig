# 0004 — Money as integer öre; append‑only bid ledger; SEK only

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

Every rank on the board is backed by real, non‑refundable money (G2, N1). The
amount a listing has paid is also its sort key, it only ever goes up, and it is
the sum of many individual payments over time. We need an auditable answer to
"how did this listing get to 17 005 kr" and a guarantee that a listing's
displayed amount always equals money that actually settled.

## Decision

**Represent all money as integer minor units — öre — in `bigint` columns.**
No floating point anywhere between the Stripe amount and the database. Currency
is **SEK only** for v1 (non‑goal: multi‑currency). Formatting to `"17 005 kr"`
happens only in the view layer, via `Intl.NumberFormat("sv-SE")`.

**The bid table is an append‑only ledger.** One row per act of paying:
`previous_amount_ore`, `delta_ore` (what was charged), `resulting_amount_ore`
(`previous + delta`). No `UPDATE` of amounts, no `DELETE`. A listing's
`current_amount_ore` is a **derived cache** of its latest settled bid's
`resulting_amount_ore`, written in the *same transaction* as the bid.

**One `Payment` per `Bid`, enforced by a unique constraint.** One settled bid
per Stripe `payment_intent`, also unique‑constrained. These two constraints are
the structural anti‑double‑charge guarantee — a ret/replay can't create a
second charge for the same bid.

Invariants (see [domain‑model](../architecture/domain-model.md) §Invariants) are
asserted hourly by a reconciliation job that replays the ledger and compares to
`current_amount_ore`.

## Consequences

### Positive
- No rounding drift, ever. `17_00` öre is exact; `17.00` is not.
- Full audit trail: the ledger *is* the history, reconstructable end to end.
- `current_amount_ore` stays a pure optimisation — if it's ever wrong, the
  ledger is the truth and the job catches the drift.
- Idempotent fulfilment falls out naturally: keyed on the Stripe event / PI,
  a replay finds the bid already settled and does nothing.

### Negative / accepted trade‑offs
- Slightly more code than "just store a decimal on the listing": we maintain
  two representations and a reconciliation job. This is the point — it buys N1.
- SEK‑only means a non‑SE buyer pays in SEK (Stripe shows their card's FX). Fine
  for a Sweden‑first product; revisit with an ADR if data says otherwise.
- öre are not user‑facing; every display path must format. Enforced by a lint
  rule against raw money interpolation + a `formatKr()` helper.

### Follow‑ups
- `src/lib/money.ts`: branded `Ore` type, `kr()`, `fromKronor()`, `addOre()`,
  no `number` arithmetic leaking out.
- DB: `CHECK (delta_ore > 0)`, `CHECK (resulting_amount_ore = previous_amount_ore + delta_ore)`.
- Unique: `payment(bid_id)`, `bid(provider_payment_intent) WHERE status='settled'`.
- Reconciliation job + alert (Flow 5 `assert-ledger`).
- Property‑based tests: replaying any ledger yields `current_amount_ore`.

## Alternatives considered

- **Decimal/`numeric` on the listing, no ledger** — loses history and audit;
  can't explain how an amount was reached; reconciliation impossible.
- **A generic double‑entry accounting schema** — overkill; we have one account
  shape (a listing's cumulative spend). Revisit if we add payouts/refunds/escrow.
- **Store money as strings** — avoids float but makes arithmetic and DB math
  awkward; integers are simpler and Postgres‑native.
- **Multi‑currency from day one** — real complexity (FX, rounding rules,
  per‑currency floors, display) for zero v1 value.
