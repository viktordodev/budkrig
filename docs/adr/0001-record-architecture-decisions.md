# 0001 — Record architecture decisions

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

Budkrig starts as a solo/small‑team build but touches money, tax, consumer law
and adversarial content — areas where "why did we do it this way" matters months
later, and where a second contributor (or a lawyer, or future‑you) needs the
reasoning, not just the code.

## Decision

Keep Architecture Decision Records in `docs/adr/`, numbered, in the trimmed
MADR format ([`0000-template.md`](0000-template.md)). One decision per file.
Records are immutable once `Accepted`; changes come as new, superseding
records. The index lives in [`README.md`](README.md).

A decision needs an ADR when it is hard to reverse, constrains many future
changes, or is non‑obvious. Reversible local choices stay in the PR
description.

## Consequences

### Positive
- New contributors ramp from `docs/`, not from archaeology.
- Forces us to name trade‑offs explicitly before committing.
- The legal/compliance conversation has written source material.

### Negative / accepted trade‑offs
- Small ongoing writing cost. Mitigated by keeping records short.

### Follow‑ups
- Link ADRs from PRs that implement or change them.

## Alternatives considered

- **No records / rely on git + memory** — fails the second‑person test.
- **One big `DECISIONS.md`** — merge conflicts, no stable anchors, tends to rot.
- **A wiki** — drifts from the code; not versioned with the change that motivates it.
