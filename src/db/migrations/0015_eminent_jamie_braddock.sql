CREATE TABLE "hotel_restaurants" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hotel_id" bigint NOT NULL,
	"restaurant_id" bigint NOT NULL,
	"delivery_fee" numeric(10, 2),
	"service_fee_percent" numeric(5, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"distance_miles" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hotel_restaurants_unique" UNIQUE("hotel_id","restaurant_id")
);
--> statement-breakpoint
ALTER TABLE "dine_in_restaurants" ADD COLUMN "latitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "dine_in_restaurants" ADD COLUMN "longitude" numeric(10, 7);--> statement-breakpoint
ALTER TABLE "hotel_restaurants" ADD CONSTRAINT "hotel_restaurants_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hotel_restaurants" ADD CONSTRAINT "hotel_restaurants_restaurant_id_dine_in_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."dine_in_restaurants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hotel_restaurants_hotel_id_index" ON "hotel_restaurants" USING btree ("hotel_id");--> statement-breakpoint
CREATE INDEX "hotel_restaurants_restaurant_id_index" ON "hotel_restaurants" USING btree ("restaurant_id");