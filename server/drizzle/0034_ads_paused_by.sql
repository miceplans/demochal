-- 광고를 누가 일시정지했는지 기록한다(owner | admin). 관리자 중단(POST /admin/ads/:id/pause)을
-- 기업이 PATCH /ads/:id {status:'active'}로 되살리지 못하게 막는 데 쓴다.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "ads" ADD COLUMN IF NOT EXISTS "paused_by" varchar(10);
