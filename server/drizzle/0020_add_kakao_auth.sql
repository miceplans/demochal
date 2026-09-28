-- Adds the Kakao OAuth identity column, mirroring naver_subject (see 0012_add_naver_auth).
-- Idempotent: re-running on an already-migrated database is a no-op.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kakao_subject" varchar(255);
CREATE UNIQUE INDEX IF NOT EXISTS "users_kakao_subject_unique" ON "users" ("kakao_subject");
