-- Outbox pattern support table. A DB transaction inserts its business row and
-- an outbox row together, so an external side effect (SQS today) is never
-- lost to a crash between the DB commit and the send; OutboxRelayService
-- polls and sends pending rows. Idempotent: re-running on an already-migrated
-- database is a no-op.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp
);
