ALTER TABLE "ads" ADD COLUMN "expires_at" timestamp;
--> statement-breakpoint
ALTER TABLE "ad_products" ADD CONSTRAINT "ad_products_placement_unique" UNIQUE("placement");
