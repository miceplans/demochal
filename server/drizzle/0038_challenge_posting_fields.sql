-- 공모전 작성 폼 개편: 인원 제한 제거(capacity nullable), 행사 기간 분리, 주최/주관/협찬/후원,
-- 대상 '기타' 직접 입력, 첨부파일. Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "challenges" ALTER COLUMN "capacity" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "event_start_date" timestamp;
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "event_end_date" timestamp;
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "host" varchar(200);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "supervisor" varchar(200);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "sponsor" varchar(200);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "supporter" varchar(200);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "target_other" varchar(100);
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "preserve_original" boolean DEFAULT false NOT NULL;
