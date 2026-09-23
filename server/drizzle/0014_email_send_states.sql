-- Email send state for the outbox-driven SES worker, keyed by the outbox event
-- id (the idempotency key). The worker claims a row as 'sending' before calling
-- SES so concurrent/duplicate SQS deliveries of one event cannot both send,
-- then marks it 'sent'. A failed send deletes its claim; a stale 'sending'
-- claim can be taken over after a worker crash.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_send_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"outbox_event_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_send_states" ADD CONSTRAINT "email_send_states_outbox_event_id_outbox_events_id_fk" FOREIGN KEY ("outbox_event_id") REFERENCES "public"."outbox_events"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_send_states_outbox_event_id_unique" ON "email_send_states" USING btree ("outbox_event_id");
