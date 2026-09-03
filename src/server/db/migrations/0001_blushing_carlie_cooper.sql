ALTER TABLE "bids" DROP CONSTRAINT "bids_arithmetic";--> statement-breakpoint
ALTER TABLE "bids" ALTER COLUMN "previous_amount_ore" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bids" ALTER COLUMN "resulting_amount_ore" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_settled_has_amounts" CHECK ("bids"."status" <> 'settled' or ("bids"."previous_amount_ore" is not null and "bids"."resulting_amount_ore" is not null));--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_arithmetic" CHECK (("bids"."previous_amount_ore" is null and "bids"."resulting_amount_ore" is null)
          or "bids"."resulting_amount_ore" = "bids"."previous_amount_ore" + "bids"."delta_ore");