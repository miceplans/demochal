-- Backs GET /ads/products, GET/POST /ads, PATCH /ads/{id}, GET /ads/{id}/report.
-- Also extends orders to support ad purchases alongside challenge-application fees.

CREATE TABLE "ad_products" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"placement" varchar(20) NOT NULL,
	"daily_price" integer NOT NULL,
	"preview_image_url" text
);

CREATE TABLE "ads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"product_id" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"image_file_id" uuid,
	"landing_url" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" varchar(20) DEFAULT 'preparing' NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ads_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id"),
	CONSTRAINT "ads_product_id_ad_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "ad_products"("id")
);

-- Seed the fixed placement catalog described in openapi.yaml (AdProduct/AdSlotPricing).
-- Prices are initial reference values — adjustable later via PUT /admin/ad-pricing.
INSERT INTO "ad_products" ("id", "name", "description", "placement", "daily_price") VALUES
	('hero', '메인 배너 (대)', '홈 상단 대형 배너, 마감 임박 공고 우선 노출', 'hero', 50000),
	('gallery', '홈 이미지 갤러리', '홈 중간 이미지 갤러리', 'gallery', 30000),
	('team', '팀 탐색 배너', '팀 탐색 페이지 배너', 'team', 20000);

ALTER TABLE "orders" ALTER COLUMN "application_id" DROP NOT NULL;
ALTER TABLE "orders" ADD COLUMN "ad_id" uuid;
ALTER TABLE "orders" ADD CONSTRAINT "orders_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "ads"("id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_exactly_one_target" CHECK (num_nonnulls("application_id", "ad_id") = 1);
