ALTER TABLE "users" ADD COLUMN "auth_provider" varchar(20) DEFAULT 'local' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_google_id_unique" UNIQUE("google_id");
