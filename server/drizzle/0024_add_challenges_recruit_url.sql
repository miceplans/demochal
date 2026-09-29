-- 외부 링크 모집 공고의 지원 URL을 저장한다. recruitMethod === 'external'일 때만
-- 의미 있으며, seMOchall(내부 신청폼) 공고에는 서비스 레이어에서 채우지 않는다.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "recruit_url" varchar(2048);
