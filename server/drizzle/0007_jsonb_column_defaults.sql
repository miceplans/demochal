-- Closes a schema-DB drift left by 0004_nasty_switch: these jsonb columns were
-- added nullable with no DEFAULT, but the ORM schema (core.schema.ts) has always
-- declared them NOT NULL with an empty-collection default. Existing NULL rows
-- are backfilled first so the NOT NULL constraint below never fails.
--> statement-breakpoint
UPDATE "users" SET "stacks" = '[]'::jsonb WHERE "stacks" IS NULL;
--> statement-breakpoint
UPDATE "users" SET "badges" = '[]'::jsonb WHERE "badges" IS NULL;
--> statement-breakpoint
UPDATE "users" SET "external_links" = '[]'::jsonb WHERE "external_links" IS NULL;
--> statement-breakpoint
UPDATE "users" SET "award_history" = '[]'::jsonb WHERE "award_history" IS NULL;
--> statement-breakpoint
UPDATE "users" SET "interests" = '[]'::jsonb WHERE "interests" IS NULL;
--> statement-breakpoint
UPDATE "users" SET "notification_settings" = '{}'::jsonb WHERE "notification_settings" IS NULL;
--> statement-breakpoint
UPDATE "businesses" SET "content_blocks" = '[]'::jsonb WHERE "content_blocks" IS NULL;
--> statement-breakpoint
UPDATE "applications" SET "teammates" = '[]'::jsonb WHERE "teammates" IS NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "stacks" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "badges" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "external_links" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "award_history" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "interests" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "notification_settings" SET DEFAULT '{}'::jsonb;
--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "content_blocks" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "teammates" SET DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "stacks" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "badges" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "external_links" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "award_history" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "interests" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "notification_settings" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "content_blocks" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "applications" ALTER COLUMN "teammates" SET NOT NULL;
