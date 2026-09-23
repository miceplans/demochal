-- Exposure-boost contract: challenges recruiting through the in-service
-- application form (recruit_method = 'seMOchall') rank higher in
-- recommendations, which is surfaced as a hint on the biz posting form.
-- Existing rows default to 'external' so current rankings do not regress.
-- Idempotent: re-running on an already-migrated database is a no-op.
--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "recruit_method" varchar(20) DEFAULT 'external' NOT NULL;
