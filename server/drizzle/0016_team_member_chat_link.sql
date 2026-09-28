-- Adds the chat link a team leader attaches when sending pass/fail results to
-- applicants (팀 지원자 결과 전송). Only accepted members carry a link, so the
-- column stays nullable and existing member rows stay valid.
-- Idempotent: re-running on an already-migrated database is a no-op.
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "chat_link" varchar(500);
