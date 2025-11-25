CREATE TYPE "public"."discount_status" AS ENUM('requested', 'redeemed');--> statement-breakpoint
CREATE TABLE "hotel_dining_discounts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hotel_id" bigint NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"status" "discount_status" DEFAULT 'requested' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "restaurant_discount" real DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "hotel_dining_discounts" ADD CONSTRAINT "hotel_dining_discounts_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hotel_user_discount_idx" ON "hotel_dining_discounts" USING btree ("hotel_id","user_id");