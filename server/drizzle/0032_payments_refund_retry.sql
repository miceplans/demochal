-- refund_pending payments (charged but the compensating Toss cancel failed,
-- see PaymentsService.compensateIfUnsettleable) were never retried: the row sat
-- until a DONE redelivery happened to re-drive the cancel. These columns back the
-- worker's retryRefundPendingPayments scan — refund_retry_count/refund_retried_at
-- give per-row exponential backoff and a hard attempt cap so a permanently
-- failing cancel cannot hammer the Toss API forever; once the cap is hit the row
-- stays 'refund_pending' for operators to refund manually.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refund_retry_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refund_retried_at" timestamp;
