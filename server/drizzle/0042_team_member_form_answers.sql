-- 팀 지원 시 지원자가 작성한 신청서(챌린지 신청서 질문) 답변을 저장한다.
-- applications.form_answers와 같은 스냅샷 형태의 jsonb — 질문이 나중에 바뀌어도
-- 지원 시점의 제목·타입·답변이 유지된다. NOT NULL DEFAULT로 기존 행은 빈 배열.
-- Idempotent: re-running on an already-migrated database is a no-op.
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "form_answers" jsonb NOT NULL DEFAULT '[]'::jsonb;
