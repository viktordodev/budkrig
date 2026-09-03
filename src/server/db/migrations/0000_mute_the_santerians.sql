CREATE TYPE "public"."bid_status" AS ENUM('pending', 'settled', 'expired', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."listing_kind" AS ENUM('url', 'handle');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('draft', 'pending_payment', 'active', 'hidden', 'removed');--> statement-breakpoint
CREATE TYPE "public"."moderation_action_kind" AS ENUM('flag', 'hide', 'restore', 'recategorise', 'edit', 'denylist_add', 'refund_remove');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'swish', 'klarna', 'wallet', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'settled', 'disputed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."tax_mode" AS ENUM('b2c_se', 'b2b_eu_reverse_charge', 'b2b_domestic', 'non_eu');--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"previous_amount_ore" bigint NOT NULL,
	"delta_ore" bigint NOT NULL,
	"resulting_amount_ore" bigint NOT NULL,
	"status" "bid_status" DEFAULT 'pending' NOT NULL,
	"event_key" text NOT NULL,
	"provider_payment_intent" text,
	"client_ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone,
	CONSTRAINT "bids_delta_positive" CHECK ("bids"."delta_ore" > 0),
	CONSTRAINT "bids_arithmetic" CHECK ("bids"."resulting_amount_ore" = "bids"."previous_amount_ore" + "bids"."delta_ore")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_sv" text NOT NULL,
	"name_en" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "click_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"ts" timestamp with time zone DEFAULT now() NOT NULL,
	"referrer_host" text,
	"ip_hash" text,
	"ua_hash" text
);
--> statement-breakpoint
CREATE TABLE "denylist" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pattern" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "denylist_pattern_unique" UNIQUE("pattern")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"kind" "listing_kind" NOT NULL,
	"target_url" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"category_id" uuid NOT NULL,
	"current_amount_ore" bigint DEFAULT 0 NOT NULL,
	"status" "listing_status" DEFAULT 'draft' NOT NULL,
	"flagged" boolean DEFAULT false NOT NULL,
	"owner_email" text NOT NULL,
	"first_active_at" timestamp with time zone,
	"last_bid_at" timestamp with time zone,
	"click_count" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_amount_nonneg" CHECK ("listings"."current_amount_ore" >= 0)
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid,
	"actor" text NOT NULL,
	"action" "moderation_action_kind" NOT NULL,
	"reason" text,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bid_id" uuid NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_session_id" text,
	"provider_payment_intent" text,
	"method" "payment_method",
	"amount_ore" bigint NOT NULL,
	"currency" text DEFAULT 'SEK' NOT NULL,
	"vat_rate" text,
	"vat_amount_ore" bigint,
	"tax_mode" "tax_mode",
	"invoice_number" text,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"raw_event" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'stripe' NOT NULL,
	"provider_event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bids_listing_created_idx" ON "bids" USING btree ("listing_id","created_at");--> statement-breakpoint
CREATE INDEX "bids_created_idx" ON "bids" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_event_key_uq" ON "bids" USING btree ("event_key");--> statement-breakpoint
CREATE UNIQUE INDEX "bids_settled_pi_uq" ON "bids" USING btree ("provider_payment_intent") WHERE "bids"."status" = 'settled' and "bids"."provider_payment_intent" is not null;--> statement-breakpoint
CREATE INDEX "click_events_listing_ts_idx" ON "click_events" USING btree ("listing_id","ts");--> statement-breakpoint
CREATE UNIQUE INDEX "listings_slug_uq" ON "listings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "listings_board_idx" ON "listings" USING btree ("current_amount_ore" DESC NULLS LAST,"first_active_at") WHERE "listings"."status" = 'active';--> statement-breakpoint
CREATE INDEX "listings_category_board_idx" ON "listings" USING btree ("category_id","current_amount_ore" DESC NULLS LAST) WHERE "listings"."status" = 'active';--> statement-breakpoint
CREATE INDEX "listings_owner_idx" ON "listings" USING btree ("owner_email");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_bid_uq" ON "payments" USING btree ("bid_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_pi_uq" ON "payments" USING btree ("provider_payment_intent") WHERE "payments"."provider_payment_intent" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_invoice_uq" ON "payments" USING btree ("invoice_number") WHERE "payments"."invoice_number" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_events_provider_event_uq" ON "webhook_events" USING btree ("provider","provider_event_id");--> statement-breakpoint
-- Gap-free invoice numbering (ADR-0007). Allocated only at payment settlement.
CREATE SEQUENCE IF NOT EXISTS "invoice_number_seq" AS bigint START WITH 1000 INCREMENT BY 1;