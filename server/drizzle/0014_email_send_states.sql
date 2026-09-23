-- Email send state for the outbox-driven SES worker. The outbox event id is
-- the idempotency key: SQS is at-least-once, so a redelivered email job checks
-- this table first and skips events already handed to SES. A row exists only
-- after a successful send; failures stay unrecorded so the queue retry/DLQ
-- policy can re-attempt them. Idempotent: re-running on an already-migrated
-- database is a no-op.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_send_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outbox_event_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_send_states" ADD CONSTRAINT "email_send_states_outbox_event_id_outbox_events_id_fk" FOREIGN KEY ("outbox_event_id") REFERENCES "public"."outbox_events"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_send_states_outbox_event_id_unique" ON "email_send_states" USING btree ("outbox_event_id");
