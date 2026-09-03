# `src/` layout

The dependency rule (enforced in review, and partly by `biome.json`):

```
app/         ─▶ modules/ ─▶ server/ ─▶ lib/
components/  ─▶ modules/ (read models), lib/
workers/     ─▶ modules/ ─▶ server/ ─▶ lib/
```

| Dir | Role | May import |
| --- | --- | --- |
| `app/` | Next.js App Router. **Routes only, thin.** Parse input → call a module → map result to response/redirect. No business logic. | `modules/`, `components/`, `lib/` |
| `components/` | Shared React. Mostly Server Components; client components are leaf-level. | `modules/` (read models), `lib/` |
| `modules/` | The domain. `listings`, `bids`, `payments`, `moderation`, `activity`. Framework- and vendor-agnostic. Defines **ports** (interfaces). | other modules' `index.ts`, `server/` *ports only*, `lib/` |
| `server/` | Infra **adapters**: db, stripe, redis, queue, email, auth tokens, config, observability. Implements the ports. | `lib/`, vendor SDKs |
| `lib/` | Pure, dependency-free utilities. `money`, `result`, `slug`, `url`, `format`. | nothing app-specific |
| `workers/` | BullMQ worker entrypoint + processors. A composition root, like `app/`. | `modules/`, `server/`, `lib/` |
| `test/` | Factories, fixtures, Testcontainers helpers. | anything |

Rules of thumb:
- A file in `modules/` that imports `stripe`, `ioredis`, `bullmq`, or `next` is
  a bug — go through a port.
- `app/` and `workers/` are the only places adapters get wired to modules.
- Cross-module access goes through the public `index.ts`, never internals.

See [`docs/conventions/engineering-guidelines.md`](../docs/conventions/engineering-guidelines.md).
