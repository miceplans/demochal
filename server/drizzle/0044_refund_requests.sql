-- 구매자 환불 요청. 관리자가 승인하면 Toss 결제 취소 + 주문 canceled 전이를 같은 트랜잭션에서 처리한다.
-- 주문당 처리 대기(requested) 요청은 하나만 허용(부분 유니크 인덱스) — 반려 후에는 재요청할 수 있다.
-- Idempotent: re-running on an already-migrated database is a no-op.
CREATE TABLE IF NOT EXISTS "refund_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id"),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "reason" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'requested',
  "admin_note" text,
  "processed_by" uuid REFERENCES "users"("id"),
  "processed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "refund_requests_open_order_unique" ON "refund_requests" ("order_id") WHERE "status" = 'requested';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refund_requests_status_created_idx" ON "refund_requests" ("status", "created_at");
