-- Email conversation storage foundation. The inbound processor can use these
-- columns without requiring the admin inbox UI to be deployed in this change.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_threads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject" varchar(998),
  "status" varchar(20) DEFAULT 'open' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_threads_updated_at_idx" ON "email_threads" USING btree ("updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "thread_id" uuid NOT NULL,
  "direction" varchar(10) NOT NULL,
  "message_id" varchar(998),
  "ses_message_id" varchar(256),
  "in_reply_to" varchar(998),
  "references" text,
  "from_address" varchar(998) NOT NULL,
  "to_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "cc_addresses" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "subject" varchar(998),
  "text_body" text,
  "html_body" text,
  "s3_object_key" text,
  "delivery_status" varchar(20) DEFAULT 'SENT' NOT NULL,
  "sent_at" timestamp,
  "received_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_messages_message_id_unique" ON "email_messages" USING btree ("message_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_messages_ses_message_id_unique" ON "email_messages" USING btree ("ses_message_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_thread_created_at_idx" ON "email_messages" USING btree ("thread_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_messages_in_reply_to_idx" ON "email_messages" USING btree ("in_reply_to");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_attachments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "message_id" uuid NOT NULL,
  "filename" varchar(255),
  "content_type" varchar(255) NOT NULL,
  "size_bytes" integer,
  "content_id" varchar(998),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_attachments_message_id_idx" ON "email_attachments" USING btree ("message_id");
