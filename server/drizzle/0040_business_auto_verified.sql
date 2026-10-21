-- 기관 가입은 서류 심사 없이 자동 승인된다: 기본값을 verified로 바꾸고 심사 대기(pending)·반려(rejected)로 남은 기관을 모두 승인 처리한다.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "verification_status" SET DEFAULT 'verified';
--> statement-breakpoint
UPDATE "businesses" SET "verification_status" = 'verified' WHERE "verification_status" IN ('pending', 'rejected');
