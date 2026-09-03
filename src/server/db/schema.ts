/**
 * Physical schema. Must stay in sync with docs/architecture/domain-model.md
 * (a PR changes both, or neither). Money columns are bigint öre (ADR-0004).
 * The `bids` table is append-only (ADR-0004): no UPDATE/DELETE of amounts.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// drizzle infers the column name from the object key when none is passed
const now = () => timestamp({ withTimezone: true }).defaultNow().notNull();

// ── enums ──────────────────────────────────────────────────────────────────
export const listingKind = pgEnum("listing_kind", ["url", "handle"]);
export const listingStatus = pgEnum("listing_status", [
  "draft",
  "pending_payment",
  "active",
  "hidden",
  "removed",
]);
export const bidStatus = pgEnum("bid_status", ["pending", "settled", "expired", "refunded"]);
export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "settled",
  "disputed",
  "refunded",
]);
export const paymentMethod = pgEnum("payment_method", [
  "card",
  "swish",
  "klarna",
  "wallet",
  "other",
]);
export const taxMode = pgEnum("tax_mode", [
  "b2c_se",
  "b2b_eu_reverse_charge",
  "b2b_domestic",
  "non_eu",
]);
export const moderationActionKind = pgEnum("moderation_action_kind", [
  "flag",
  "hide",
  "restore",
  "recategorise",
  "edit",
  "denylist_add",
  "refund_remove",
]);

// ── categories (seeded, not user-created) ─────────────────────────────────
export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  nameSv: text("name_sv").notNull(),
  nameEn: text("name_en").notNull(),
  sort: integer("sort").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// ── listings ─────────────────────────────────────────────────────────────
export const listings = pgTable(
  "listings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    kind: listingKind("kind").notNull(),
    targetUrl: text("target_url").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),

    /** derived cache of the latest settled bid's resulting_amount_ore */
    currentAmountOre: bigint("current_amount_ore", { mode: "number" }).notNull().default(0),

    status: listingStatus("status").notNull().default("draft"),
    flagged: boolean("flagged").notNull().default(false),

    ownerEmail: text("owner_email").notNull(),

    /** set exactly once, at first fulfilment; tiebreaker for equal amounts */
    firstActiveAt: timestamp("first_active_at", { withTimezone: true }),
    lastBidAt: timestamp("last_bid_at", { withTimezone: true }),
    clickCount: bigint("click_count", { mode: "number" }).notNull().default(0),

    createdAt: now(),
    updatedAt: now(),
  },
  (t) => ({
    slugUq: uniqueIndex("listings_slug_uq").on(t.slug),
    // the board: active listings ordered by amount desc, then first_active asc
    boardIdx: index("listings_board_idx")
      .on(t.currentAmountOre.desc(), t.firstActiveAt.asc())
      .where(sql`${t.status} = 'active'`),
    categoryBoardIdx: index("listings_category_board_idx")
      .on(t.categoryId, t.currentAmountOre.desc())
      .where(sql`${t.status} = 'active'`),
    ownerIdx: index("listings_owner_idx").on(t.ownerEmail),
    amountNonNeg: check("listings_amount_nonneg", sql`${t.currentAmountOre} >= 0`),
  }),
);

// ── bids (APPEND-ONLY ledger) ────────────────────────────────────────────
export const bids = pgTable(
  "bids",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),

    // delta is fixed at claim time (what Stripe is asked to charge). previous /
    // resulting are the ledger amounts — NULL while pending, written once at
    // settlement against the locked listing row (ADR-0004 / ADR-0005).
    deltaOre: bigint("delta_ore", { mode: "number" }).notNull(),
    previousAmountOre: bigint("previous_amount_ore", { mode: "number" }),
    resultingAmountOre: bigint("resulting_amount_ore", { mode: "number" }),

    status: bidStatus("status").notNull().default("pending"),

    /** our own idempotency token, also passed to Stripe as metadata */
    eventKey: text("event_key").notNull(),
    /** Stripe payment_intent — unique among SETTLED bids (anti double-charge) */
    providerPaymentIntent: text("provider_payment_intent"),

    clientIpHash: text("client_ip_hash"),

    createdAt: now(), // the date used for the "Today" board
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => ({
    listingCreatedIdx: index("bids_listing_created_idx").on(t.listingId, t.createdAt),
    createdIdx: index("bids_created_idx").on(t.createdAt),
    eventKeyUq: uniqueIndex("bids_event_key_uq").on(t.eventKey),
    settledPiUq: uniqueIndex("bids_settled_pi_uq")
      .on(t.providerPaymentIntent)
      .where(sql`${t.status} = 'settled' and ${t.providerPaymentIntent} is not null`),
    deltaPositive: check("bids_delta_positive", sql`${t.deltaOre} > 0`),
    // Amounts are both NULL (pending) or both set and consistent (settled).
    arithmetic: check(
      "bids_arithmetic",
      sql`(${t.previousAmountOre} is null and ${t.resultingAmountOre} is null)
          or ${t.resultingAmountOre} = ${t.previousAmountOre} + ${t.deltaOre}`,
    ),
    // A settled bid must have its ledger amounts.
    settledHasAmounts: check(
      "bids_settled_has_amounts",
      sql`${t.status} <> 'settled' or (${t.previousAmountOre} is not null and ${t.resultingAmountOre} is not null)`,
    ),
  }),
);

// ── payments (one per bid) ───────────────────────────────────────────────
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bidId: uuid("bid_id")
      .notNull()
      .references(() => bids.id),

    provider: text("provider").notNull().default("stripe"),
    providerSessionId: text("provider_session_id"),
    providerPaymentIntent: text("provider_payment_intent"),

    method: paymentMethod("method"),
    amountOre: bigint("amount_ore", { mode: "number" }).notNull(),
    currency: text("currency").notNull().default("SEK"),

    vatRate: text("vat_rate"), // numeric-as-text to avoid float; e.g. "0.25"
    vatAmountOre: bigint("vat_amount_ore", { mode: "number" }),
    taxMode: taxMode("tax_mode"),
    invoiceNumber: text("invoice_number"),

    status: paymentStatus("status").notNull().default("pending"),
    rawEvent: jsonb("raw_event"),

    createdAt: now(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => ({
    bidUq: uniqueIndex("payments_bid_uq").on(t.bidId),
    piUq: uniqueIndex("payments_pi_uq")
      .on(t.providerPaymentIntent)
      .where(sql`${t.providerPaymentIntent} is not null`),
    invoiceUq: uniqueIndex("payments_invoice_uq")
      .on(t.invoiceNumber)
      .where(sql`${t.invoiceNumber} is not null`),
  }),
);

// ── webhook events (idempotency + replay) ────────────────────────────────
export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull().default("stripe"),
    providerEventId: text("provider_event_id").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    attempts: integer("attempts").notNull().default(0),
    error: text("error"),
    receivedAt: now(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (t) => ({
    providerEventUq: uniqueIndex("webhook_events_provider_event_uq").on(
      t.provider,
      t.providerEventId,
    ),
  }),
);

// ── moderation ───────────────────────────────────────────────────────────
export const denylist = pgTable("denylist", {
  id: uuid("id").primaryKey().defaultRandom(),
  pattern: text("pattern").notNull().unique(), // domain, handle, or regex
  reason: text("reason").notNull(),
  createdAt: now(),
});

export const moderationActions = pgTable("moderation_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  listingId: uuid("listing_id").references(() => listings.id),
  actor: text("actor").notNull(), // operator email or "system"
  action: moderationActionKind("action").notNull(),
  reason: text("reason"),
  before: jsonb("before"),
  after: jsonb("after"),
  createdAt: now(),
});

// ── click events (hot, pruned aggressively) ─────────────────────────────
export const clickEvents = pgTable(
  "click_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    ts: now(),
    referrerHost: text("referrer_host"),
    ipHash: text("ip_hash"),
    uaHash: text("ua_hash"),
  },
  (t) => ({
    listingTsIdx: index("click_events_listing_ts_idx").on(t.listingId, t.ts),
  }),
);

// Invoice numbers are allocated from a dedicated gap-free sequence at
// settlement (ADR-0007). Created in a migration:
//   CREATE SEQUENCE invoice_number_seq;
