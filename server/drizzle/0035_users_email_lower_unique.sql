-- 이메일 중복 가입 방지를 대소문자 무시로 맞춘다 — 로그인/가입 조회는 모두 lower(email) 기준
-- (auth.service register/login)인데 유니크 제약만 대소문자를 구분해 A@x.com / a@x.com 이
-- 각각 가입될 수 있었다. Idempotent: re-running on an already-migrated database is a no-op.
-- 이미 lower(email) 기준 중복인 데이터가 있으면 인덱스 생성이 실패하며, 그 환경에서는
-- 중복 행을 정리한 뒤 재실행해야 한다(자동 정리는 destructive라 하지 않는다).
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_unique" ON "users" (lower("email"));
