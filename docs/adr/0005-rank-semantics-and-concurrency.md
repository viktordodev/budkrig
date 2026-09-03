# 0005 — Rank semantics and concurrency model

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

The headline feature is a live ranked board where people spend real money to
move up, sometimes many at once during a spike (N3, N4). Naive designs create
nasty concurrency: if a rank is a scarce unique slot, two simultaneous "claim
#1" payments contend for it, and one buyer ends up charged without the slot →
refund, support, chargeback. We must define rank precisely so that **taking
money and granting rank cannot come apart**.

## Decision

### Rank is derived, not stored

`position = ` index of the listing when active listings are ordered by:

```
ORDER BY current_amount_ore DESC, first_active_at ASC
```

A single listing's position is one indexed `COUNT(*) + 1` query. There is no
`rank` column to keep in sync.

### Amounts are absolute and NOT unique

A listing's amount is "total kronor paid", a point on a number line — not a slot.
Two listings can hold the same amount; `first_active_at` breaks the tie
(earlier fulfilment ranks higher). Consequence: **there is nothing scarce to
contend for.** Every settled payment simply sets its listing's amount; where
that lands on the board is whatever it is at that instant.

### Thresholds are advisory at request time, authoritative at fulfilment

To claim/raise, the resulting amount must clear:

```
max(NEW_LISTING_MIN_ORE, previous_amount_ore + MIN_INCREMENT_ORE)
```

Checked in the Server Action for UX ("the floor moved, try again") **before**
taking money. Re‑checked by the worker at fulfilment as the authority. If the
board moved between request and settlement, that's fine — the payment still
succeeds and the listing ranks wherever its amount now places it. **We never
refund because "someone else got there first"**, because there was never a
unique prize.

### The only lock is a per‑listing row lock

Fulfilment does `SELECT ... FOR UPDATE` on the **one** listing being updated,
to serialise the rare case of two payments for the *same* listing. It's short
and uncontended. No table locks, no advisory locks, no global "leaderboard
mutex".

### "Today" board

Ranked among listings with ≥ 1 bid whose `created_at` is today
(Europe/Stockholm), ordered by **sum of today's `delta_ore`** desc. Computed
from the ledger; cached with a short TTL.

## Consequences

### Positive
- Concurrent claims can't deadlock, can't double‑spend, can't strand a buyer.
- The board is a pure function of the ledger — trivially cacheable (N4) and
  trivially auditable (N1).
- No distributed lock service; Postgres row locks are enough.
- Load testing is straightforward: hammer concurrent claims, assert the ledger.

### Negative / accepted trade‑offs
- Two buyers *can* briefly both believe they're "#1" if their payments settle
  in the same second; the tiebreak resolves it and the loser is prompted to
  raise. This is acceptable (and arguably good for the dollar‑auction loop). UI
  must show live position, not a stale "you are #1".
- Position is O(log n) per lookup, not O(1). At this data size (thousands of
  rows, right index) it's sub‑millisecond. Cache the top N anyway.
- `MIN_INCREMENT_ORE` / `NEW_LISTING_MIN_ORE` are config, and changing them
  doesn't retroactively invalidate anything — by design.

### Follow‑ups
- Index: `(status, current_amount_ore DESC, first_active_at ASC)` partial on
  `status = 'active'`.
- Config keys + defaults in `.env.example`; document the "+5 for #1" question
  (Open question Q3) — implement as a pluggable threshold function.
- Concurrency test suite: N parallel claims on one listing, N parallel claims
  across listings, replay assertion.
- UI: live position via polling (ADR‑0009), never trust a rendered rank older
  than a few seconds on the claim screen.

## Alternatives considered

- **Unique integer rank slots** — creates the scarce resource and all the
  contention/refund pain we're avoiding. Rejected.
- **Serialize all claims through a queue / single writer** — kills throughput
  during exactly the spike we need to survive, and still needs the refund path
  for "outbid in flight".
- **Optimistic concurrency with retry on the listing amount** — fine for
  same‑listing races (we get it via `FOR UPDATE`), unnecessary across listings
  since there's no shared state.
- **Store `rank` and maintain with triggers** — a write to any listing touches
  many rows; contention + lock escalation during a spike. The derived query is
  cheaper and simpler.
