-- 기업 회원가입(`/biz/login`) 최신 디자인 계약:
-- - users: 로그인 아이디, 휴대폰, 이메일/휴대폰 인증 시각, 약관 동의 기록
-- - businesses: 가입 폼에서 기관명·사업자번호를 받지 않으므로 nullable (OCR/프로필 편집으로 채움)
-- - contact_verifications: 이메일/휴대폰 인증번호(해시) 저장
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" varchar(50);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar(30);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone_verified_at" timestamp;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "terms_agreements" jsonb;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "name" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "businesses" ALTER COLUMN "registration_number" DROP NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel" varchar(10) NOT NULL,
  "target" varchar(255) NOT NULL,
  "code_hash" varchar(64) NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "expires_at" timestamp NOT NULL,
  "verified_at" timestamp,
  "consumed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_verifications_target_idx"
  ON "contact_verifications" ("channel", "target", "created_at");
