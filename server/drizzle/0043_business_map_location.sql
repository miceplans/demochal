-- 기업 프로필 구글 지도 핀 위치(위도/경도). 둘 다 null이면 지도는 주소 기준으로 표시한다.
-- 소수 좌표라 별도 제약 없이 nullable — 기존 행은 위치 미지정 상태를 그대로 유지.
-- Idempotent: re-running on an already-migrated database is a no-op.
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "map_latitude" double precision;
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "map_longitude" double precision;
