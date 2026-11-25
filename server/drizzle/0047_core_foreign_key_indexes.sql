-- applications·orders·teams·ads의 외래키 전체와, 조회가 잦은 그 밖의 외래키 5개에 인덱스를 추가한다.
-- PostgreSQL은 외래키에 인덱스를 자동 생성하지 않아 조인·목록 조회가 전체 스캔으로 동작한다.
-- drizzle migrator가 트랜잭션 안에서 실행하므로 CONCURRENTLY는 쓸 수 없다.
-- Idempotent: re-running on an already-migrated database is a no-op.
CREATE INDEX IF NOT EXISTS "applications_challenge_id_idx" ON "applications" ("challenge_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "applications_user_id_idx" ON "applications" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_application_id_idx" ON "orders" ("application_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_ad_id_idx" ON "orders" ("ad_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_user_id_idx" ON "orders" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_challenge_id_idx" ON "teams" ("challenge_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_leader_user_id_idx" ON "teams" ("leader_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ads_business_id_idx" ON "ads" ("business_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ads_product_id_idx" ON "ads" ("product_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "businesses_owner_user_id_idx" ON "businesses" ("owner_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "verifications_business_id_idx" ON "verifications" ("business_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "challenges_business_id_idx" ON "challenges" ("business_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "team_members_user_id_idx" ON "team_members" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bookmarks_challenge_id_idx" ON "bookmarks" ("challenge_id");
