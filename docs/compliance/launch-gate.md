# Launch gate — living checklist

**Budkrig does not launch to the public until every box here is checked.**
The rationale for each item is in [ADR‑0015](../adr/0015-pre-launch-legal-compliance-gate.md);
this file is the tracker. Owner: Viktor.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done (with a link
to the evidence — an email, a signed doc, a commit).

---

## 0. Blocking — do not launch without these

- [ ] **Gambling‑law opinion** (Swedish gambling/gaming lawyer). Written view on
      whether the mechanic is *lotteri / spel / kombinationsspel* under
      Spellagen (2018:1138). If any risk → required product changes or a
      decision not to launch. — R1
- [ ] **Consumer‑law review** of: the withdrawal‑waiver wording + consent flow
      (`src/content/legal.ts` §Ångerrätt, `messages/*.json` `claim.consent`),
      the non‑refundable clause (§2), the pre‑contract info on the checkout
      screen. Against Distansavtalslagen (2005:59) + Marknadsföringslagen. — R8
- [ ] **Company + VAT registered**, F‑skatt confirmed. Fill
      `src/content/legal.ts` `COMPANY` (name, org.nr, VAT nr, address). — Q1
- [ ] **Stripe account** fully verified as the registered business; accurate
      business description; Stripe told of the expected launch spike. — R6

## 1. Payments & tax (code mostly done — M3a)

- [x] Swish before credit ordering — `CHECKOUT_PAYMENT_METHODS`
- [x] VAT‑inclusive pricing + `automatic_tax` + VAT‑id collection behind
      `STRIPE_TAX_ENABLED`
- [x] VAT breakdown captured per payment (`vat_rate` / `vat_amount_ore` /
      `tax_mode`)
- [ ] **Activate** Swish, Klarna and Stripe Tax on the account, then set
      `CHECKOUT_PAYMENT_METHODS=swish,card,klarna` + `STRIPE_TAX_ENABLED=true`
- [ ] **Invoicing** — gap‑free numbered VAT invoice PDF per settled payment,
      7‑year archival. *Not built* — needs email + object storage (own slice).
- [ ] Accountant signs off Stripe Tax settings + OSS applicability
- [ ] Dispute‑response runbook (`docs/runbooks/` — TODO); consent + delivery
      evidence auto‑attached

## 2. Content / platform liability

- [x] Outbound links pass through `/go/{slug}` (no open redirect); disclaimer in
      the site footer (`src/components/site-footer.tsx`)
- [ ] Third‑party brand / domain listing policy decided + written into
      `src/content/legal.ts` §4 — Q4
- [ ] `/report` route + operator queue (Milestone 4)
- [ ] DSA applicability assessed; notice‑and‑action + point of contact if in
      scope

## 3. Data protection (GDPR)

- [x] PII minimised: email + salted IP hash + payment metadata + consent record
- [x] EU‑only hosting + EU Stripe; cookie‑free (no tracking analytics)
- [x] Privacy policy drafted (`src/content/legal.ts` `privacy`)
- [ ] Records of processing (Art. 30) written
- [ ] DPAs signed with every subprocessor (Stripe, email, hosting/storage, URL
      safety) — list them in the privacy policy §Mottagare
- [ ] Retention jobs: purge `owner_email` from removed listings after N months;
      click events already pruned at 30 days
- [ ] DSAR (access / deletion) procedure documented
- [ ] `SENTRY_DSN` set (self‑hosted GlitchTip/Sentry, EU)

## 4. Corporate identity disclosure

- [x] `/foretagsinformation` page exists
- [ ] Filled with real org.nr / VAT nr / address (`COMPANY` in
      `src/content/legal.ts`)

## 5. Ops readiness (from Milestone 1)

- [ ] Uptime monitor on a **separate** host hitting `/healthz`
- [ ] Postgres backups enabled + one **restored** rehearsal → `docs/runbooks/restore.md`
- [ ] `APP_ENV=production` set in Coolify; demo listings removed

---

When section 0 is green and the rest is either done or has a dated waiver
recorded here, update [ADR‑0015](../adr/0015-pre-launch-legal-compliance-gate.md)
status to `Accepted` and launch.
