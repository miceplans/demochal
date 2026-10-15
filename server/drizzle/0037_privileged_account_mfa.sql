-- 관리자·사업자 계정 2단계 인증 저장소 추가 (#567)
-- user_totp_credentials: 계정당 TOTP 시크릿 1개(AES-256-GCM 암호문 저장, verified_at이 null이면 등록 대기)
-- user_passkey_credentials: WebAuthn 패스키 공개키 자격 증명
-- user_mfa_recovery_codes: 복구 코드 sha256 해시(평문 미저장), 단회 사용(used_at)
-- user_mfa_challenges: WebAuthn 등록·인증 단회 challenge(만료·사용 검증)
-- Idempotent: re-running on an already-migrated database is a no-op
-- (테이블·인덱스 모두 IF NOT EXISTS, FK는 CREATE TABLE 내 inline REFERENCES라 재실행 시 무시된다).
CREATE TABLE IF NOT EXISTS "user_totp_credentials" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "secret_ciphertext" text NOT NULL,
  "verified_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_passkey_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "credential_id" text NOT NULL UNIQUE,
  "public_key" text NOT NULL,
  "counter" integer DEFAULT 0 NOT NULL,
  "transports" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_mfa_recovery_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_hash" text NOT NULL UNIQUE,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_mfa_challenges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" varchar(20) NOT NULL,
  "challenge" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_passkey_credentials_user_id_idx" ON "user_passkey_credentials" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_mfa_recovery_codes_user_id_idx" ON "user_mfa_recovery_codes" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_mfa_challenges_user_id_idx" ON "user_mfa_challenges" ("user_id");
