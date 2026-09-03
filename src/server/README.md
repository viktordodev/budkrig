# `server/` — infra adapters

Implements the ports that `modules/` declare. This is the only layer allowed to
import vendor SDKs.

| Dir | Contents |
| --- | --- |
| `config/` | `env.ts` (Zod-parsed `process.env` — the only reader), `i18n.ts` (next-intl), typed `config` object. |
| `db/` | `schema.ts` (Drizzle), `client.ts` (pooled `postgres` client, `casing: "snake_case"`), `migrations/` (generated SQL), `repositories/` (return domain types, not row shapes), `seed.ts`. |
| `payments/` | `stripe.ts` (client), `stripe-checkout-adapter.ts` (implements `payments` ports), webhook signature verification helper. |
| `redis/` | `client.ts` (ioredis), `cache.ts` (get/set/invalidate helpers + key builders), `rate-limit.ts`. |
| `queue/` | BullMQ connection, the **job registry** (one place; each job has a Zod payload schema + idempotency key + retry policy). |
| `email/` | Provider adapter (resend / postmark / smtp) + templates (receipt, invoice, manage link, "you were passed"). |
| `auth/` | `manage-link.ts` — sign/verify the single-listing, short-TTL JWT (ADR-0008). Operator-area gate. |
| `observability/` | `logger.ts` (pino), `request-id.ts` (middleware), `otel.ts`, `health.ts` (`/healthz`, `/readyz`, checkout canary). |

Adapters are constructed once per entrypoint and passed into module functions —
no module reaches into `server/` for a concrete implementation.
