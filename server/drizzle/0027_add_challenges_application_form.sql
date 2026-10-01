-- biz 콘솔 "신청서(질문지) 만들기" 화면(#264)이 작성한 질문 목록을 공고(challenges)에
-- 직접 저장한다. 별도 테이블 대신 jsonb 배열 컬럼으로 붙인다(질문 6종·순서·필수여부만
-- 담는 단순 구조). 기존 행은 아직 신청폼이 없으므로 nullable, 기본값 없음.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "application_form" jsonb;
