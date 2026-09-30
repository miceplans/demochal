ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "targets" text[];
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "organizer_type" varchar(30);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "prize_amount" integer;
