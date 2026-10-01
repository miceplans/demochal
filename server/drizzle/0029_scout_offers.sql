ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "scouted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "scout_message" varchar(200);
