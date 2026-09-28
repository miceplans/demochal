-- Exposure-boost contract: challenges recruiting through the in-service
-- application form rank higher in recommendations.
-- Existing rows default to 'external' so current rankings do not regress.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "recruit_method" varchar(20) DEFAULT 'external' NOT NULL;
