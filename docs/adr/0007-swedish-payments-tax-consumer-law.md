# 0007 — Swedish payment methods, VAT/invoicing, consumer‑law checkout

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor (+ accountant, + lawyer for sign‑off — see ADR‑0015)

## Context

Budkrig is Sweden‑first (G4). That is more than translation:

- **Payment behaviour**: Swish is the dominant Swedish online payment method
  (~40%+ of e‑commerce shoppers), BankID‑bound, effectively fraud‑free. Klarna
  (BNPL, Swedish origin) is also large. A **2020 Swedish law requires direct
  payment options (Swish) to be presented before credit‑based options (Klarna
  Pay Later)** at checkout.
- **Swish and Klarna settle asynchronously** — the buyer approves in a separate
  app — so payment confirmation is not synchronous with the redirect back.
- **VAT (moms)**: 25% standard rate on advertising services. B2B within the EU
  is generally **reverse charge** (no Swedish VAT, buyer's VAT number required
  and validated); B2C in the EU and Swedish buyers get 25%; non‑EU differs.
- **Invoicing / bookkeeping**: Swedish Bokföringslagen requires proper invoices
  with sequential, **gap‑free** numbers, seller org.nr + VAT nr, retained 7
  years.
- **Consumer law**: EU distance selling gives a 14‑day right of withdrawal. For
  a digital service performed immediately, that right is only waived with the
  buyer's **express prior consent + acknowledgement that they lose it**
  (Swedish Distansavtalslagen 2005:59). Without it, "non‑refundable" is not
  enforceable against consumers (R8).

## Decision

### Payment methods (via Stripe, ADR‑0006)

- Enable, in this presentation order: **Swish → cards → Apple/Google Pay →
  Klarna**. Direct methods before credit methods, per the 2020 law.
- `currency: "sek"` always.
- Fulfilment path is identical for every method: webhook → worker (Flow 1b).
  The UI never implies "paid" until the webhook confirms settlement; for
  Swish/Klarna the claim screen says *"Confirm in your app — we'll email you
  the second it clears."* (R12)

### Tax

- **Stripe Tax** with `automatic_tax` on the Checkout Session to determine and
  apply VAT.
- Checkout collects **country** always and an optional **VAT number**; a valid
  EU VAT number (VIES‑checked by Stripe) → reverse charge, `tax_mode =
  b2b_eu_reverse_charge`. Swedish buyers and EU B2C → 25%. Store `vat_rate`,
  `vat_amount_ore`, `tax_mode` on the payment (ADR‑0004 schema).
- We reconcile Stripe Tax reports for the Skatteverket VAT return / OSS.

### Invoicing

- Generate a compliant invoice (PDF + email) per settled payment, numbered from
  a **Postgres sequence** (gap‑free), including seller identifiers, buyer
  country/VAT, VAT breakdown or the reverse‑charge notice, and the öre‑exact
  amounts. Store `invoice_number` on the payment; archive the PDF to object
  storage for 7 years.

### Consumer‑law checkout step

- Before redirecting to Stripe, a **mandatory checkbox** (unticked by default):
  *"Jag samtycker till att tjänsten börjar utföras omedelbart och att jag
  därmed förlorar min ångerrätt."* (Wording to be lawyer‑approved.)
- Store the consent (text version + timestamp + IP hash) linked to the bid.
- Terms + non‑refundable policy linked and summarised on the same screen.

## Consequences

### Positive
- Matches how Swedes actually pay; Swish promotion also lowers fraud/dispute
  rate (R4).
- VAT + invoicing handled correctly from the first krona — no retroactive
  clean‑up with Skatteverket.
- "Non‑refundable" becomes actually enforceable against consumers (R8).

### Negative / accepted trade‑offs
- More checkout friction (country, consent checkbox). Necessary; keep it to one
  screen.
- Stripe Tax has a per‑transaction cost. Accepted vs. the cost of getting VAT
  wrong.
- Async methods mean a visible "pending" state and clear comms (R12). Handled
  in UI + the receipt email.
- Invoice numbering via a DB sequence must never roll back — enforced by using
  a dedicated sequence, allocated only at settlement.

### Follow‑ups
- Legal review of: withdrawal‑waiver wording, terms, refund policy, the
  domain‑listing / third‑party‑brand policy (ADR‑0015, Open questions Q4/Q5).
- Accountant: confirm company vehicle, VAT registration, OSS applicability
  (Q1).
- Implement invoice PDF templating in the worker; 7‑year archival + retention
  job.
- `företagsinformation` / imprint page with org.nr, VAT nr, contact (replaces
  outbid.lol's German "Impressum").
- Config: payment‑method order, `DEFAULT_COUNTRY=SE`, tax settings.

## Alternatives considered

- **Cards only for v1** — simplest, but ignores how the target market pays and
  raises fraud exposure. Rejected; Swish is core to the localisation thesis.
- **Merchant‑of‑record (Paddle/LemonSqueezy)** — offloads VAT + invoicing, but
  no real Swish support and mechanic‑acceptability risk (see ADR‑0006). Kept as
  a fallback only.
- **Manual invoicing / spreadsheets** — not gap‑free, not scalable, error‑prone
  at spike volume. Rejected.
- **Ignore the withdrawal right, rely on "all sales final" text** —
  unenforceable against consumers and a regulator/chargeback magnet (R8).
