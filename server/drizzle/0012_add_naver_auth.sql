-- Adds the Naver OAuth identity column, mirroring google_subject (see 0001_add_google_auth,
-- 0005_reconcile_auth_reports). Idempotent: re-running on an already-migrated database is a no-op.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "naver_subject" varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS "users_naver_subject_unique" ON "users" ("naver_subject");
