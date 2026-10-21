-- 챌린지 정원 기능을 제거한다: 더 이상 쓰지 않는 capacity 컬럼을 삭제한다.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "challenges" DROP COLUMN IF EXISTS "capacity";
