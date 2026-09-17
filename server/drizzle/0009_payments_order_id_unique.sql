-- One payment row per order: Toss webhook handlers upsert on payments.order_id,
-- so concurrent deliveries for the same order must conflict instead of inserting
-- duplicate payment rows.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payments_order_id_unique" ON "payments" USING btree ("order_id");
