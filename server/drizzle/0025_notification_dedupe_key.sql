ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" varchar(100);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_user_dedupe_key_idx" ON "notifications" USING btree ("user_id","dedupe_key");
