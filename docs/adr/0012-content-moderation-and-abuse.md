# 0012 — Content moderation and abuse handling

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

Budkrig is a public, SEO‑indexed board that anyone can put a URL on by paying,
tied to our company name and brand. Week‑one adversaries (R5, R13, R4): scam /
malware links, offensive text, listing a competitor's or celebrity's brand
without consent, and payment fraud / chargebacks. We take money *before* review
(ADR‑0005: no scarce slot, we never withhold a paid rank), so moderation is
**post‑publish** — which means it must be fast and auditable. Operator is one
person.

## Decision

### Pre‑publish automated checks (in fulfilment, Flow 1b)

Before flipping a listing to `active`, run cheap checks and set a `flagged`
marker (the listing still goes live — money was taken):

- Domain / `@handle` against a **denylist** (maintained in DB, operator‑editable).
- Domain **age** (very new) and **risky TLD** heuristic → flag.
- **Keyword scan** on title + description (scam/adult/hate/□ terms, SE + EN).
- **URL safety**: reachability + Google Safe Browsing / similar lookup.
- Rate/velocity: many listings from one IP or email in a short window → flag.

Flagged listings appear in the operator queue with the reason.

### Operator queue

- Actions: `hide`, `restore`, `recategorise`, `edit copy`, `add to denylist`,
  `refund + remove` (exceptional, ADR‑0004 §9).
- Every action writes a `ModerationAction` row with actor, reason, before/after.
- `hidden` listings keep `current_amount_ore` and `first_active_at`; restoring
  is lossless.
- SLA target: triage the queue at least daily; malware/illegal within hours.

### Outbound links

- All outbound links: `rel="nofollow ugc sponsored"`, `target="_blank"`,
  `referrerpolicy="no-referrer"`. We pass through
  `GET /go/{slug}` (click counting) — never an open redirect; `slug` is looked
  up, `target_url` is validated + normalised at listing time.
- A visible, standing disclaimer: listings are paid placements, not endorsed by
  or affiliated with the linked sites.

### Third‑party brands / domains (R13)

Policy decision needed (Open question Q4). Default recommendation for v1:
**allow listing any URL, with a documented notice‑and‑takedown process** and an
opt‑in DNS/meta **verification** that grants a "verified owner" badge + copy
editing rights. Revisit if C&D volume is high.

### Payment abuse

- `charge.dispute.created` → flag listing + alert operator, **no auto‑hide**;
  respond to the dispute with the consent record + terms + delivery proof
  (the live listing).
- Watch dispute rate against Stripe's threshold (R4); promote Swish (R7‑low
  fraud) in the UI.
- `radar` rules + 3DS from ADR‑0006.

### Legal takedown / illegal content

- A `/report` form (email + reason + listing) → operator queue, high priority.
- Documented process to remove + preserve evidence + notify authorities where
  required. Aligns with EU DSA expectations for a hosting service of user
  content (confirm scope with lawyer, ADR‑0015).

## Consequences

### Positive
- Money path stays frictionless (G1); review doesn't block buyers.
- Auditable trail for every moderation action → defensible in disputes and to
  regulators.
- Automated flags concentrate the operator's limited time on real problems.
- `nofollow ugc sponsored` protects our domain from being an SEO laundromat and
  reduces incentive to spam.

### Negative / accepted trade‑offs
- A bad listing *is briefly live* before the operator acts. Accepted
  consequence of "never withhold a paid rank"; mitigated by auto‑flags + fast
  triage + the disclaimer.
- Operator toil. Mitigated by good tooling (the queue is a Milestone‑4
  deliverable, not an afterthought) and denylist growth over time.
- Notice‑and‑takedown (vs. upfront verification) means some brand complaints.
  Bounded by a clear, fast process and the verification opt‑in.

### Follow‑ups
- Schema: `denylist`, `moderation_actions`, `flagged` fields, `reports`.
- Operator area (IP/SSO‑gated) with the queue + `bull-board` + denylist editor.
- Safe Browsing (or equivalent) integration + key.
- `/report` form + email routing.
- Legal: DSA applicability, takedown process wording, brand‑listing policy (Q4).
- Runbook: `docs/runbooks/abuse.md`.

## Alternatives considered

- **Pre‑publish manual review of every listing** — kills the "pay → instantly
  live" magic and doesn't scale to a spike or one operator. Rejected.
- **No moderation, react only to reports** — guarantees a brand‑damaging
  incident in week one on a product this visible. Rejected.
- **Third‑party moderation API for everything** — cost + latency + a
  subprocessor; use targeted external checks (Safe Browsing) only.
- **Mandatory domain verification to list** — best abuse protection, too much
  friction as the only path; offered as an opt‑in badge instead.
