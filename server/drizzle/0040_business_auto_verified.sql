-- 기관 가입은 서류 심사 없이 자동 승인된다: 기본값을 verified로 바꾸고 심사 대기(pending)·반려(rejected)로 남은 기관을 모두 승인 처리한다.
-- 가입 시 국세청 조회 결과(nts_result)를 기록하는 컬럼을 추가하고, 처리 경로가 사라진 심사 대기(pending) 인증 요청도 승인으로 확정한다.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "verification_status" SET DEFAULT 'verified';
--> statement-breakpoint
UPDATE "businesses" SET "verification_status" = 'verified' WHERE "verification_status" IN ('pending', 'rejected');
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "nts_result" varchar(20);
--> statement-breakpoint
UPDATE "verifications" SET "status" = 'verified', "updated_at" = now() WHERE "status" = 'pending';
