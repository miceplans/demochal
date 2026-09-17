-- Drops the dead "status" column from users. Suspension state lives in the
-- "suspended" boolean (+ suspended_reason/suspended_at, added in 0006); the admin
-- API's status field is computed from that boolean, never persisted in this column.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "status";
