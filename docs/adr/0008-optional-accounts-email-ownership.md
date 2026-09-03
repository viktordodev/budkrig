# 0008 — No mandatory accounts; email‑based listing ownership

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

The reference product has no visible account system — you submit a URL, pay, and
your listing is live; to raise it you submit the same URL with a higher amount.
Ownership appears to be "whoever can pay for that slug". We want the lowest
friction on the paid conversion path (G1) and the least PII to hold (N8, R9),
but the owner still needs to **edit their listing copy** and we need a
defensible notion of "who controls this listing" for support and disputes.

## Decision

- **No username/password, no OAuth, no mandatory sign‑up** for v1.
- At checkout we collect an **email** (Stripe Checkout collects it anyway). On
  first settled bid for a slug, that email becomes the listing's `owner_email`.
- **Listing management is via a signed magic link**: the owner requests it by
  entering their email; if it matches a listing we send a link to
  `/manage?token=…`. The token is a short‑lived (24h), single‑listing‑scoped
  JWT signed with a server‑only key. No session cookie, no persistent login.
- The manage page allows editing **title, description, target_url** — never the
  amount (that's a paid bid) and never the category once the listing is ranked.
  Edits re‑run moderation checks (ADR‑0012).
- Email enumeration is prevented: the request endpoint always responds "check
  your inbox", rate‑limited per IP + per email.
- `owner_email` is stored to allow: the magic link, the receipt/invoice, and a
  future "your listing was passed" notification (opt‑in). It is **not** shown
  publicly. Store it plain for v1 (we need to send to it and match on it);
  document it in the privacy policy and retention schedule.
- **Raising** an existing listing does not require the link — anyone can pay to
  raise any listing (that's the game). But **editing copy** requires it.
- Better Auth (used by `supastarter`) is the chosen path **if/when** we add real
  accounts (operator console, opt‑in dashboards) — not now.

## Consequences

### Positive
- Zero friction on the money path — the thing that must convert (G1).
- Minimal PII: one email per listing, plus payment metadata. Small DSAR /
  breach surface (N8, R9).
- No password storage, no account‑takeover surface, no "forgot password" flow.
- The operator console can be a separate, IP‑ or SSO‑gated area without
  entangling public users.

### Negative / accepted trade‑offs
- No "my listings" dashboard for owners with multiple listings — they get one
  link per listing. Acceptable for v1; a light dashboard can come later keyed
  on verified email.
- Magic links in email have the usual risks (forwarded link = access). Mitigated
  by short TTL, single‑listing scope, re‑issue on each request, and that the
  blast radius is "edit ad copy", not money.
- If someone loses access to their email, support has to verify ownership
  another way (payment reference). Documented in a support runbook.
- `owner_email` stored plain is a PII item to guard (R14) — covered by DB
  least‑privilege, backups encryption, and retention limits.

### Follow‑ups
- `LISTING_MANAGEMENT_JWT_SECRET` in `.env.example` (server‑only, rotatable).
- Token helper in `src/server/auth/manage-link.ts`; tests for expiry/scope/tamper.
- Rate limits (Redis) on the link‑request and edit endpoints.
- Privacy policy: what we store, why, how long, how to request deletion.
- Retention job: purge `owner_email` from `removed` listings after N months
  unless there's an open dispute.
- Decide opt‑in vs no "you were passed" emails (product + anti‑spam).

## Alternatives considered

- **Full accounts (Better Auth) from day one** — friction on the exact step
  that must convert, more PII, more attack surface, for features (dashboards)
  that are non‑goals. Deferred, not discarded.
- **No ownership at all** (anyone edits any listing if they pay) — invites
  vandalism of listing copy and impersonation. Rejected.
- **Domain/handle verification (DNS TXT / meta tag) as the ownership proof** —
  stronger, and worth considering for the "listing someone else's brand"
  problem (Q4/R13), but too much friction as the *only* path. Possible
  opt‑in "verified" badge later.
- **Magic link that logs into a real session** — more capability than v1 needs;
  brings session management back in. The scoped, stateless token is enough.
