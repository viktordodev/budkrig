# 0006 — Stripe hosted Checkout for one‑time payments

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

We take one‑off payments (no subscriptions) from mostly Swedish buyers. We need
Swedish payment methods — Swish above all, plus Klarna and cards (ADR‑0007) —
SEK, VAT handling, fraud protection, and the **smallest possible PCI and
security burden** for a solo operator (N7). Payments are non‑refundable, which
raises dispute risk (R4), so fraud tooling matters. The reference product and
`supastarter` both use Stripe.

## Decision

- **Stripe** as the payment service provider. Onboard as a real Swedish
  business (Open question Q1).
- **Stripe Checkout (hosted, `mode: "payment"`)** — we redirect the buyer to a
  Stripe‑hosted page and never see card data. PCI scope stays **SAQ‑A**.
- One **Checkout Session per bid**, created server‑side with:
  `currency: "sek"`, `line_items` for the bid delta, the payment‑method set
  from ADR‑0007, `metadata: { bid_id, event_key }`, and
  `idempotency_key: bid_id` on the create call.
- **Fulfilment is webhook‑only** (`checkout.session.completed` +
  `payment_intent.succeeded`), processed via the worker, idempotent on the
  Stripe event id (core‑flows Flow 1b). The redirect `return_url` only shows
  "processing / we'll email you" — it never moves money or state.
- **Stripe Radar** on; **3DS**/SCA enforced (required in the EU anyway).
- **Stripe Tax** for VAT determination + `automatic_tax` on the session
  (ADR‑0007).
- All payment‑provider calls sit behind a `PaymentProvider` interface in
  `src/server/payments/` so a second PSP is a bounded change (R6).

## Consequences

### Positive
- Card data never touches our servers, logs, or DB → SAQ‑A, minimal audit
  surface, much lower breach blast radius (N7, R14).
- Swish, Klarna, cards, Apple/Google Pay all through one integration and one
  reconciliation surface.
- Radar + hosted 3DS is meaningfully better fraud defence than we'd build (R4).
- Hosted page is PSD2/SCA‑compliant and localised by Stripe.

### Negative / accepted trade‑offs
- Less control over checkout UX (it's Stripe's page, lightly themable). Fine —
  the value is the board, not the checkout.
- Full Stripe dependency for revenue (R6). Mitigated by the adapter interface
  and by onboarding cleanly.
- A redirect round‑trip. Negligible.
- Stripe fees (cards ~1.5% EEA + fixed; Swish + Klarna priced separately).
  Accepted cost of not building payments.

### Follow‑ups
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` (only
  if we ever need Elements) in `.env.example`.
- Webhook Route Handler: verify signature against the **raw** body; store every
  event in `webhook_events` before doing anything.
- Configure the webhook endpoint + events in the Stripe dashboard per env;
  document in `infrastructure.md`.
- Reconciliation job against Stripe (Flow 5 `reconcile-stripe`).
- Dispute webhook (`charge.dispute.created`) → operator alert (ADR‑0012).

## Alternatives considered

- **Stripe Elements / Payment Element (embedded)** — nicer UX, but pulls PCI
  scope up to SAQ‑A‑EP and adds client‑side complexity. Not worth it for v1.
- **Stripe Payment Links** — no per‑bid dynamic amount / metadata control we
  need. Rejected.
- **Klarna direct / Swish direct (bank agreement)** — cheaper per‑transaction,
  but multiple integrations, multiple settlement/reconciliation flows, our own
  SCA handling, and a Swish merchant agreement to negotiate. Revisit only at
  volume where fees dominate.
- **Paddle / Lemon Squeezy (merchant of record)** — they'd own VAT/invoicing
  (a real plus), but weak/again‑no Swish support and less fraud control; the
  mechanic may also trip their acceptable‑use review. Rejected for v1, noted as
  a fallback if Stripe onboarding fails.
