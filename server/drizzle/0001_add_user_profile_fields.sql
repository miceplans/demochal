-- Backs PATCH /users/me and PUT /users/me/survey: public-profile fields shown on
-- `/profile`/`/my`, plus the 4-step onboarding survey answers (stored as-is).
ALTER TABLE "users" ADD COLUMN "position" varchar(100);
ALTER TABLE "users" ADD COLUMN "region" varchar(100);
ALTER TABLE "users" ADD COLUMN "stacks" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "users" ADD COLUMN "badges" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "users" ADD COLUMN "external_links" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "users" ADD COLUMN "award_history" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "users" ADD COLUMN "onboarding_survey" jsonb;
