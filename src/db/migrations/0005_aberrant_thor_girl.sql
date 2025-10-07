CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "dine_in_order_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"menu_item_id" bigint NOT NULL,
	"menu_item_guid" uuid NOT NULL,
	"item_name" varchar(255) NOT NULL,
	"item_description" text,
	"base_price" numeric(10, 2) NOT NULL,
	"modifier_price" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"modifier_details" jsonb,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dine_in_orders" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hotel_id" bigint NOT NULL,
	"restaurant_id" bigint NOT NULL,
	"user_id" bigint NOT NULL,
	"room_number" varchar(10) NOT NULL,
	"special_instructions" text,
	"total_amount" varchar(20) NOT NULL,
	"order_status" "order_status" DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dine_in_payments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"stripe_payment_intent_id" varchar(255) NOT NULL,
	"amount" varchar(20) NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"stripe_metadata" jsonb,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hotels" ADD COLUMN "stripe_account_id" varchar(255);--> statement-breakpoint
ALTER TABLE "dine_in_order_items" ADD CONSTRAINT "dine_in_order_items_order_id_dine_in_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."dine_in_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dine_in_order_items" ADD CONSTRAINT "dine_in_order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dine_in_orders" ADD CONSTRAINT "dine_in_orders_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dine_in_orders" ADD CONSTRAINT "dine_in_orders_restaurant_id_dine_in_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."dine_in_restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dine_in_payments" ADD CONSTRAINT "dine_in_payments_order_id_dine_in_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."dine_in_orders"("id") ON DELETE no action ON UPDATE no action;