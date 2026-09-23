CREATE TABLE IF NOT EXISTS "ad_event_counters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ad_id" uuid NOT NULL,
  "bucket_start" timestamp NOT NULL,
  "impressions" integer DEFAULT 0 NOT NULL,
  "clicks" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ad_event_counters_ad_bucket_unique" UNIQUE("ad_id", "bucket_start")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ad_event_counters" ADD CONSTRAINT "ad_event_counters_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
