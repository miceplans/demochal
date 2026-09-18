-- Toss PARTIAL_CANCELED webhooks were previously ignored entirely, so a
-- partially-refunded payment row still had its full original "amount" counted
-- as current platform revenue (see AdminService.getAnalytics). This column
-- persists the cumulative amount Toss reports as canceled for a payment (set
-- from Toss's balanceAmount on each reconciled PARTIAL_CANCELED webhook, never
-- incremented, so a redelivered webhook converges to the same value instead of
-- double-counting) so revenue can be computed as amount - refunded_amount per row.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refunded_amount" integer DEFAULT 0 NOT NULL;
