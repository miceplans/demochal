-- PG 결제 키(토스 paymentKey / 네이버페이 paymentId)는 결제 1건당 1개이므로 한 주문에만 묶이게 한다.
-- 같은 결제로 주문 2건을 병렬 confirm해 이중 정산하는 race를 DB 레벨에서 막는다.
-- Idempotent: re-running on an already-migrated database is a no-op.
CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_payment_key_unique" ON "payments" ("provider", "provider_payment_key");
