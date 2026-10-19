-- 인증 요청에 증명 파일을 여러 개 첨부할 수 있도록 file_ids(jsonb 배열)를 추가한다. file_id는 첫 번째 파일로 유지한다.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "file_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "certificates" SET "file_ids" = jsonb_build_array("file_id") WHERE "file_ids" = '[]'::jsonb;
