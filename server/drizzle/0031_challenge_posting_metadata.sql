ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "summary" varchar(300);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "hashtags" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "topics" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "inquiry_contact" varchar(200);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "visibility" varchar(20) NOT NULL DEFAULT 'public';
