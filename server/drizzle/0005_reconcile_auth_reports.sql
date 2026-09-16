-- Additive reconciliation for the contracts introduced by the recovery migrations.
-- Every statement preserves existing tables and rows.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_subject" varchar(255);
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "users_google_subject_unique" ON "users" ("google_subject");

ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "rejection_reason" text;

ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "target_id" uuid;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reported_user_id" uuid;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "resolution_note" text;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "reported_at" timestamp DEFAULT now();
ALTER TABLE "reports" ALTER COLUMN "org" DROP NOT NULL;
ALTER TABLE "reports" ALTER COLUMN "detail" DROP NOT NULL;
ALTER TABLE "reports" ALTER COLUMN "reporter_name" DROP NOT NULL;
