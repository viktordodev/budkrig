# `lib/` — pure utilities

Zero app-specific dependencies. Deterministic, unit-testable in isolation.

| File | Purpose |
| --- | --- |
| `money.ts` | `Ore` branded type, öre arithmetic, `requiredMinimum()` (ADR-0005), `formatKr()`. **The only place money math lives.** |
| `result.ts` | `Result<T,E>`, `ok`/`err`, `assertNever`. |
| `slug.ts` *(todo)* | URL/@handle → stable slug; normalisation. |
| `url.ts` *(todo)* | Validate + normalise a target URL; extract registrable domain; risky-TLD check input. |
| `format.ts` *(todo)* | Locale-aware date/number formatting wrappers. |

If you're about to add a dependency here, stop — `lib/` stays pure.
