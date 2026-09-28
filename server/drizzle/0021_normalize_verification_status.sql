-- 기관 인증의 "승인" 상태값을 'verified' 하나로 통일한다. 워커 자동 승인/NTS 통과는
-- 'verified', 관리자 승인은 'approved'를 써서 통계·목록·사용자 표시가 어긋났다(#262).
-- Idempotent: re-running on an already-migrated database is a no-op.
UPDATE "businesses" SET "verification_status" = 'verified' WHERE "verification_status" = 'approved';--> statement-breakpoint
UPDATE "verifications" SET "status" = 'verified' WHERE "status" = 'approved';
