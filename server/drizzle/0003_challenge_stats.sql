-- Backs GET /challenges/{id}/stats and /challenges/{id}/similar.

ALTER TABLE "challenges" ADD COLUMN "category" varchar(100);

CREATE TABLE "challenge_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "challenge_views_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id")
);
CREATE INDEX "challenge_views_challenge_id_idx" ON "challenge_views" ("challenge_id");
