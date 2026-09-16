-- Backs the Admin cluster: businesses review list, certificates review, ads/ad-pricing
-- admin views, users management, reports, contents monitoring, dashboard/analytics, settings.

ALTER TABLE "businesses" ADD COLUMN "type" varchar(50);

ALTER TABLE "users" ADD COLUMN "suspended" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "suspended_reason" text;

ALTER TABLE "ads" ADD COLUMN "ad_number" serial NOT NULL;

CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"award" varchar(200) NOT NULL,
	"category" varchar(20) NOT NULL,
	"file_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id")
);

CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" varchar(200) NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" uuid,
	"org" varchar(200),
	"summary" varchar(200) NOT NULL,
	"detail" text,
	"reporter_user_id" uuid,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"reported_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id")
);

CREATE TABLE "admin_settings" (
	"id" varchar(20) PRIMARY KEY NOT NULL,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL
);

-- Seed the singleton settings row with the documented defaults so GET /admin/settings
-- never has to fabricate values on first read.
INSERT INTO "admin_settings" ("id", "values") VALUES
	('singleton', '{"bizAutoApprove": false, "contestAutoPublish": false, "maintenanceMode": false, "reportAlert": true}'::jsonb);
