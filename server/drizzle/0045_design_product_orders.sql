-- 디자인 상품(포스터 시안·오프닝 영상) 주문 구분 컬럼. 광고/챌린지 신청 주문은 null.
-- Idempotent: re-running on an already-migrated database is a no-op.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "design_product" varchar(30);
