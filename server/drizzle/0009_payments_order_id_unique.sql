-- One payment row per order: Toss webhook handlers upsert on payments.order_id,
-- so concurrent deliveries for the same order must conflict instead of inserting
-- duplicate payment rows.
-- Production rollout: inspect and resolve any existing duplicate order_id rows
-- with an approved retention policy before applying this migration. This index
-- intentionally fails rather than silently deleting financial audit records.
-- Apply this migration before deploying webhook code that uses ON CONFLICT(order_id).
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_order_id_unique" ON "payments" USING btree ("order_id");
