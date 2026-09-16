-- Backs the newly-implemented Teams, Bookmarks, Interests, Applications detail/update,
-- Businesses profile edit, and Operations inquiry endpoints.

CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"leader_user_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"leader_role" varchar(50),
	"region" varchar(100),
	"open_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'recruiting' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teams_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id"),
	CONSTRAINT "teams_leader_user_id_users_id_fk" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id")
);

CREATE TABLE "bookmarks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"challenge_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bookmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id"),
	CONSTRAINT "bookmarks_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id")
);
CREATE UNIQUE INDEX "bookmarks_user_id_challenge_id_idx" ON "bookmarks" ("user_id", "challenge_id");

CREATE TABLE "operation_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"contact" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "users" ADD COLUMN "interest_categories" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "users" ADD COLUMN "notification_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "businesses" ADD COLUMN "banner_image_file_id" uuid;
ALTER TABLE "businesses" ADD COLUMN "logo_image_file_id" uuid;
ALTER TABLE "businesses" ADD COLUMN "address" varchar(300);
ALTER TABLE "businesses" ADD COLUMN "phone" varchar(30);
ALTER TABLE "businesses" ADD COLUMN "email" varchar(255);
ALTER TABLE "businesses" ADD COLUMN "content_blocks" jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE "applications" ADD COLUMN "role" varchar(100);
ALTER TABLE "applications" ADD COLUMN "teammates" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "applications" ADD COLUMN "form_answers" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "applications" ADD COLUMN "evaluation" varchar(20) DEFAULT 'undecided' NOT NULL;
ALTER TABLE "applications" ADD COLUMN "manager_memo" text;
