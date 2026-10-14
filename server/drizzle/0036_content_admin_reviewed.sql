-- 관리자 콘텐츠 모니터링(/admin/contents)의 '확인' 처리 시각. 값이 있으면 '확인해야하는 팀/챌린지'
-- 목록에서 제외한다. Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "admin_reviewed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "admin_reviewed_at" timestamp;
