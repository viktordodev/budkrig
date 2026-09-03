# 0015 — Pre‑launch legal & compliance gate

- Status: Proposed  *(becomes Accepted once the checklist owner + lawyer are engaged)*
- Date: 2026-09-03
- Deciders: Viktor (+ Swedish lawyer, + accountant)

## Context

Budkrig takes non‑refundable money from consumers and businesses in Sweden,
publishes user‑submitted content, and runs an escalating‑stakes mechanic that
*looks* adjacent to gambling. Getting any of VAT, consumer law, gambling law,
GDPR, or platform liability wrong is an existential risk, not a bug (R1, R8, R9,
R13). These are not decisions engineering can make. This ADR makes "we have
addressed them" an explicit, blocking pre‑launch gate.

## Decision

**Budkrig does not launch to the public until every item below is checked off
and recorded in `docs/compliance/launch-gate.md`, with the named external
advisor's sign‑off where indicated.**

### 1. Company & tax  *(accountant)*
- [ ] Company vehicle chosen and registered (AB / enskild firma) — Open Q1.
- [ ] VAT (moms) registration; OSS registration if selling B2C cross‑border EU.
- [ ] F‑skatt confirmed.
- [ ] Invoice format reviewed for Bokföringslagen (sequential gap‑free numbers,
      required fields, 7‑year archival) — implements ADR‑0007.
- [ ] Stripe Tax settings reviewed against the accountant's guidance.

### 2. Gambling‑law assessment  *(Swedish gambling/gaming lawyer)* — **hard blocker, R1**
- [ ] Written opinion on whether the mechanic constitutes *lotteri* / *spel* /
      "kombinationsspel" under Spellagen (2018:1138), i.e. is there stake +
      chance + prize, or a pyramid‑scheme characterisation.
- [ ] If any risk: required product changes (framing, refund treatment,
      disclosure) or a decision not to launch.
- [ ] Marketing copy reviewed to avoid gambling framing ("win", "jackpot",
      "prize").

### 3. Consumer law  *(consumer/e‑commerce lawyer)* — R8
- [ ] Withdrawal‑right waiver wording (immediate performance of digital
      service) approved — implements ADR‑0007. Consent capture reviewed.
- [ ] Terms of Service, refund/"non‑refundable" policy, and pricing disclosure
      reviewed against Distansavtalslagen (2005:59) and Marknadsföringslagen.
- [ ] Pre‑contractual information requirements met on the checkout screen.
- [ ] `Swish‑before‑credit` checkout ordering confirmed compliant.

### 4. Content / platform liability  *(same lawyer)* — R5, R13
- [ ] DSA applicability assessed; if in scope: notice‑and‑action mechanism,
      T&Cs clause, transparency obligations, point of contact.
- [ ] Third‑party brand / domain listing policy decided and documented — Open Q4.
- [ ] Notice‑and‑takedown process written (`docs/runbooks/abuse.md`).
- [ ] Outbound‑link disclaimer wording approved.
- [ ] `/report` route live and routed.

### 5. Data protection (GDPR)  *(privacy review; DPO not required at this scale but confirm)* — R9
- [ ] Records of processing (Art. 30) written: what PII (email, IP hash,
      payment metadata, consent records), purpose, legal basis, retention.
- [ ] Privacy Policy published (Swedish + English).
- [ ] DPAs signed with every subprocessor: Stripe, email provider, object
      storage, Safe Browsing / URL‑check provider, error tracker host.
- [ ] All processing + hosting confirmed EU‑region (ADR‑0011, ADR‑0013).
- [ ] Retention jobs implemented (purge `owner_email` from removed listings;
      prune click events; invoice archive kept 7y as a legal‑basis exception).
- [ ] DSAR (access/deletion) procedure documented.
- [ ] Cookie position confirmed: analytics is cookie‑free (ADR‑0013); if any
      non‑essential cookie is added later, a consent mechanism is required.

### 6. Corporate identity disclosure  *(e‑handelslagen / e‑commerce directive)*
- [ ] `/foretagsinformation` (imprint) page: legal name, org.nr, VAT nr,
      geographic address, email. Replaces outbid.lol's German "Impressum".

### 7. Payments  *(Stripe)* — R4, R6
- [ ] Stripe account fully verified as the registered business; accurate
      business description / MCC.
- [ ] Stripe informed of expected launch volume/spike.
- [ ] Dispute‑response runbook written; consent + delivery evidence auto‑attached.

## Consequences

### Positive
- The scary, non‑engineering risks have named owners and a definition of done.
- "Are we allowed to launch?" has a single, auditable answer.
- Forces the legal spend to happen during Milestone 3, not after an incident.

### Negative / accepted trade‑offs
- Real cost (legal + accountant fees) and calendar time before revenue.
  This is the cost of the product category, not optional.
- The gambling‑law opinion could require product changes or block launch
  entirely. Better to learn that at Milestone 3 than from Spelinspektionen.

### Follow‑ups
- Create `docs/compliance/launch-gate.md` as the living checklist.
- Engage lawyer + accountant at the start of Milestone 3.
- Nominate the gate owner (founder).

## Alternatives considered

- **Launch first, fix compliance if it grows** — the failure modes here are
  payment blocking, fines, forced shutdown, and personal liability. Not an
  acceptable gamble for this mechanic in this jurisdiction.
- **Copy outbid.lol's German legal pages** — wrong jurisdiction; German
  Impressum/Spielrecht/AGB do not map to Swedish law.
- **Generic online T&C templates only** — the gambling‑adjacency and
  immediate‑performance‑digital‑service points need a human who knows Swedish
  law.
