-- Completes the schema contract on top of the recovery chain (0000-0005).
-- Every statement is idempotent and additive: existing rows are preserved,
-- re-running the migration on an already-migrated database is a no-op.
--> statement-breakpoint
-- users: 정지 여부 플래그 (status/suspended_* 와 병용, ORM 계약상 NOT NULL)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "suspended" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- files: 업로드 요청 시 지정한 버킷. 기존 행은 현재 버킷 값으로 승격시킨 뒤 NOT NULL로 고정
-- (복구 체인이 upload_status/uploader_user_id 만 추가하고 이 컬럼을 누락했음)
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "requested_bucket" varchar(20);
UPDATE "files" SET "requested_bucket" = "bucket" WHERE "requested_bucket" IS NULL;
ALTER TABLE "files" ALTER COLUMN "requested_bucket" SET NOT NULL;
--> statement-breakpoint
-- challenge_views: GET /challenges/{id}/stats·/similar 가 기록하는 조회 로그 테이블
CREATE TABLE IF NOT EXISTS "challenge_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_views_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenge_views_challenge_id_idx" ON "challenge_views" ("challenge_id");
--> statement-breakpoint
-- ad_products/ads: 복구 체인이 id/product_id 를 uuid 로 만들었으나 ORM 계약은 varchar(50)
-- (코드가 'hero'/'gallery'/'team' 같은 문자열 id 를 사용). 기존 FK 를 잠시 제거하고
-- 양쪽 컬럼 타입을 맞춘 뒤 FK 를 재생성한다. 기존 uuid 값은 텍스트로 보존.
ALTER TABLE "ads" DROP CONSTRAINT IF EXISTS "ads_product_id_ad_products_id_fk";
--> statement-breakpoint
ALTER TABLE "ad_products" ALTER COLUMN "id" TYPE varchar(50) USING "id"::text;
--> statement-breakpoint
ALTER TABLE "ads" ALTER COLUMN "product_id" TYPE varchar(50) USING "product_id"::text;
--> statement-breakpoint
ALTER TABLE "ads" ADD CONSTRAINT "ads_product_id_ad_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "ad_products"("id");
--> statement-breakpoint
-- ads: 복구 체인이 누락한 노출 번호 (serial). ORM 계약상 NOT NULL 이며
-- GET /ads/products 등 전체 조회 SELECT 에 항상 포함됨
ALTER TABLE "ads" ADD COLUMN IF NOT EXISTS "ad_number" serial;
--> statement-breakpoint
-- applications: 지원서 폼 답변. NOT NULL + 빈 배열 기본값 (ORM 계약)
ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "form_answers" jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
-- businesses: 사업자 유형 (nullable, varchar(50))
ALTER TABLE "businesses" ADD COLUMN IF NOT EXISTS "type" varchar(50);
--> statement-breakpoint
-- teams: 팀장 역할 (nullable, varchar(50))
ALTER TABLE "teams" ADD COLUMN IF NOT EXISTS "leader_role" varchar(50);
