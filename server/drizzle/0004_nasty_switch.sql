CREATE TABLE "admin_settings" (
	"id" varchar(20) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"values" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_challenge_id_unique" UNIQUE("user_id","challenge_id")
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"category" varchar(20) NOT NULL,
	"file_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"contact" varchar(255) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"billing_key" varchar(255) NOT NULL,
	"card_name" varchar(100),
	"masked_number" varchar(30) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_cards_billing_key_unique" UNIQUE("billing_key")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" varchar(300) NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"org" varchar(200) NOT NULL,
	"summary" varchar(300) NOT NULL,
	"detail" text NOT NULL,
	"reporter_user_id" uuid,
	"reporter_name" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_id_user_id_unique" UNIQUE("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"leader_user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"region" varchar(100),
	"open_roles" jsonb,
	"status" varchar(20) DEFAULT 'recruiting' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "application_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "role" varchar(100);--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "teammates" jsonb;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "evaluation" varchar(20) DEFAULT 'undecided' NOT NULL;--> statement-breakpoint
ALTER TABLE "applications" ADD COLUMN "manager_memo" text;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "banner_image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "logo_image_file_id" uuid;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "address" varchar(300);--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "phone" varchar(30);--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "email" varchar(255);--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "content_blocks" jsonb;--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "category" varchar(100);--> statement-breakpoint
ALTER TABLE "challenges" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "upload_status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "uploader_user_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "ad_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_reason" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "suspended_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "position" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "region" varchar(100);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stacks" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "badges" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "external_links" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "award_history" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_survey" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "interests" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notification_settings" jsonb;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_cards" ADD CONSTRAINT "payment_cards_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_user_id_users_id_fk" FOREIGN KEY ("leader_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploader_user_id_users_id_fk" FOREIGN KEY ("uploader_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_ad_id_ads_id_fk" FOREIGN KEY ("ad_id") REFERENCES "public"."ads"("id") ON DELETE no action ON UPDATE no action;