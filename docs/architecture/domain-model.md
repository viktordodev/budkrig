# Domain Model

Companion to [`00-overview.md`](00-overview.md). This is the conceptual model
and its invariants. The physical schema lives in
[`src/server/db/schema.ts`](../../src/server/db/schema.ts) and must not drift
from this document without an ADR or a PR that updates both.

## Ubiquitous language

| Term | Meaning |
| --- | --- |
| **Listing** | One entry on the board: a product URL *or* an `@handle`, plus a title, description and category. |
| **Amount** | The cumulative kronor a listing has paid, in **öre** (integer). This is the rank key. Never decreases. |
| **Bid** | A single act of paying. Appends to the ledger. `delta` is what was charged now; `resulting_amount` is the listing's amount afterwards. |
| **Claim** | The first bid on a listing (creates it, or revives a removed one). |
| **Raise** | A subsequent bid that increases an existing listing's amount. |
| **Rank / position** | Derived. 1‑based index when active listings are ordered by `(amount DESC, first_active_at ASC)`. |
| **Floor** | The amount of the listing directly above you — what you must clear to pass it. |
| **Settled** | Stripe has confirmed the money moved (`payment_intent.succeeded` / `checkout.session.completed` with `payment_status = paid`). |
| **Fulfilment** | The transaction that turns a settled payment into a visible, ranked listing. |

## Entities

### Listing
| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid (v7) | |
| `slug` | text, unique | Derived from domain or handle, e.g. `see.io`, `@jonathan_wilke`. Stable; the public URL is `/product/{slug}`. |
| `kind` | enum `url` \| `handle` | |
| `target_url` | text | Where the outbound click goes. For handles, the profile URL. Validated, normalised, `utm_source` appended at click time not stored. |
| `title` | text | Shown on the card. |
| `description` | text (≤ 280) | |
| `category_id` | fk → Category | |
| `current_amount_ore` | bigint, ≥ 0 | **Derived cache** of the latest bid's `resulting_amount_ore`. Maintained in the same transaction as the bid. |
| `status` | enum | `draft` → `pending_payment` → `active` ⇄ `hidden` → `removed` |
| `owner_email` | citext | Proves ownership; used for the management link. Stored hashed for lookup + encrypted for display, or plain if we accept the exposure — decide in ADR‑0008. |
| `first_active_at` | timestamptz, null until first fulfilment | Tiebreaker for equal amounts. Immutable once set. |
| `last_bid_at` | timestamptz | |
| `click_count` | bigint | Aggregated from ClickEvent by the worker. |
| `created_at` / `updated_at` | timestamptz | |

Indexes: `(status, current_amount_ore DESC, first_active_at ASC)` for the board;
`slug` unique; `category_id, status, current_amount_ore DESC` for category
boards; `owner_email` for management.

### Bid  *(append‑only — no `UPDATE`, no `DELETE`)*
| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid v7 | |
| `listing_id` | fk → Listing | |
| `previous_amount_ore` | bigint | Listing amount before this bid (0 for a claim). |
| `delta_ore` | bigint, > 0 | Amount charged for this bid. |
| `resulting_amount_ore` | bigint | `previous + delta`. |
| `status` | enum `pending` \| `settled` \| `expired` \| `refunded` | |
| `payment_id` | fk → Payment, nullable while pending | |
| `client_ip_hash` | text | Salted hash, for rate‑limiting + abuse only. |
| `created_at` | timestamptz | The date used for the **"Today"** board. |
| `settled_at` | timestamptz, nullable | |

### Payment
| Field | Type | Notes |
| --- | --- | --- |
| `id` | uuid v7 | |
| `bid_id` | fk → Bid, unique | One payment per bid. |
| `provider` | enum `stripe` | |
| `provider_session_id` | text | Checkout Session id. |
| `provider_payment_intent` | text, unique nullable | |
| `method` | enum `card` \| `swish` \| `klarna` \| `wallet` \| `other` | |
| `amount_ore` | bigint | Gross, incl. VAT. Must equal `bid.delta_ore`. |
| `currency` | char(3), always `SEK` | |
| `vat_rate` | numeric | e.g. `0.25`. |
| `vat_amount_ore` | bigint | |
| `tax_mode` | enum `b2c_se` \| `b2b_eu_reverse_charge` \| `b2b_domestic` \| `non_eu` | Drives invoice wording. |
| `invoice_number` | text, unique nullable | Sequential, gap‑free per Bokföringslagen. |
| `status` | enum `pending` \| `settled` \| `disputed` \| `refunded` | |
| `raw_event` | jsonb | Last relevant Stripe event payload. |
| `created_at` / `settled_at` | timestamptz | |

### Category  *(seeded, not user‑created)*
`id`, `slug`, `name_sv`, `name_en`, `sort`, `is_active`. Mirrors the
outbid.lol category set, Swedish‑labelled.

### WebhookEvent  *(idempotency + replay)*
`id`, `provider`, `provider_event_id` **unique**, `type`, `received_at`,
`processed_at` nullable, `attempts`, `payload` jsonb, `error` nullable.

### ModerationAction
`id`, `listing_id`, `actor` (operator email or `system`), `action`
(`flag` \| `hide` \| `restore` \| `recategorise` \| `edit`), `reason`,
`before` jsonb, `after` jsonb, `created_at`.

### ClickEvent  *(hot, high‑volume, prune aggressively)*
`id`, `listing_id`, `ts`, `referrer_host` nullable, `ip_hash`, `ua_hash`.
Aggregated to `listing.click_count` every few minutes, rows older than N days
deleted.

## Invariants

These are enforced in code + DB constraints + tests. Breaking one is a Sev‑1.

1. **A listing is `active` iff it has ≥ 1 `settled` bid.** No listing is visible
   without settled money; no settled bid without an eventually‑visible listing
   (unless later `hidden`/`removed` by moderation).
2. **`listing.current_amount_ore` == the `resulting_amount_ore` of that
   listing's most recent `settled` bid.** Always. Recomputable by replaying the
   ledger; a reconciliation job asserts this hourly.
3. **`amount` is monotonic non‑decreasing per listing.** Every `settled` bid has
   `delta_ore > 0` and `resulting_amount_ore > previous_amount_ore`.
4. **`bid.delta_ore == payment.amount_ore`** for every settled bid.
5. **One `Payment` per `Bid`; one settled `Bid` per Stripe `payment_intent`.**
   Enforced by unique constraints. This is the anti‑double‑charge guarantee.
6. **Fulfilment is idempotent on `provider_event_id`.** Processing the same
   Stripe event twice is a no‑op.
7. **`first_active_at` is set exactly once** and never changes — it is the
   tiebreaker, so mutating it would reorder the board retroactively.
8. **A claim/raise must clear the threshold:**
   `resulting_amount_ore >= max(NEW_LISTING_MIN_ORE, previous_amount_ore + MIN_INCREMENT_ORE)`.
   Validated at request time (UX) and re‑validated at fulfilment (authority).
9. **Bids are non‑refundable by policy.** A `refunded` bid is an exceptional,
   operator‑initiated event that also sets the listing's amount back by
   replaying the ledger without that bid, and is always logged as a
   `ModerationAction`. (Open question Q5.)
10. **Money is only ever integer öre.** No floats anywhere in the money path.
    Formatting to "1 234 kr" happens at the view layer only.

## What is deliberately *not* modelled in v1

- Users, sessions, passwords, OAuth. (ADR‑0008)
- Auction end times, winners, payouts, escrow.
- Bid retraction / editing.
- Multiple owners per listing, transfers of ownership.
- Per‑click outbound analytics beyond the counter.
- Currencies other than SEK.
