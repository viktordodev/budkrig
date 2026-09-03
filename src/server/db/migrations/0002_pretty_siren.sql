ALTER TABLE "bids" ADD COLUMN "withdrawal_consent_version" text;--> statement-breakpoint
ALTER TABLE "bids" ADD COLUMN "withdrawal_consent_at" timestamp with time zone;