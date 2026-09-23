-- Adds the team recruitment survey fields (팀 소개 / 우대사항 / 기타) shown on the
-- team post detail page. All nullable so existing teams stay valid.
-- Idempotent: re-running on an already-migrated database is a no-op.
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "introduction" text;
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "preferred" varchar(200);
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "etc" varchar(200);
