-- Backs GET/POST /billing/cards, GET /billing/history, GET /biz/dashboard.

CREATE TABLE "payment_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"card_name" varchar(100),
	"masked_number" varchar(30) NOT NULL,
	"billing_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_cards_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "businesses"("id")
);
