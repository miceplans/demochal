-- Billing authorization attempt ledger. Records one row per Toss billing
-- authKey exchange attempt (keyed by sha256(authKey) — the one-time key itself
-- is never stored) so a retried callback after a lost HTTP response returns
-- the already-registered card instead of reporting failure or duplicating
-- the card. Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_auth_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"auth_key_hash" varchar(64) NOT NULL,
	"card_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "billing_auth_attempts" ADD CONSTRAINT "billing_auth_attempts_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_auth_attempts" ADD CONSTRAINT "billing_auth_attempts_card_id_payment_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."payment_cards"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "billing_auth_attempts" ADD CONSTRAINT "billing_auth_attempts_auth_key_hash_unique" UNIQUE("auth_key_hash");
