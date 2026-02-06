-- Tables may already exist from previous migrations, use IF NOT EXISTS
CREATE TABLE IF NOT EXISTS "chat_conversations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guest_id" bigint NOT NULL,
	"hotel_id" bigint NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guest_preferences" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"guest_id" bigint NOT NULL,
	"preference_type" varchar(50) NOT NULL,
	"preference_value" text NOT NULL,
	"confidence" numeric(3, 2) DEFAULT '1.0' NOT NULL,
	"source" varchar(20) DEFAULT 'stated' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dine_in_order_items" DROP CONSTRAINT IF EXISTS "dine_in_order_items_menu_item_id_menu_items_id_fk";
--> statement-breakpoint
ALTER TABLE "dine_in_order_items" ALTER COLUMN "menu_item_id" DROP NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_guest_id_guest_profiles_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guest_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "guest_preferences" ADD CONSTRAINT "guest_preferences_guest_id_guest_profiles_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guest_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversations_guest_id_idx" ON "chat_conversations" USING btree ("guest_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "chat_conversations_hotel_id_idx" ON "chat_conversations" USING btree ("hotel_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guest_preferences_guest_id_idx" ON "guest_preferences" USING btree ("guest_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guest_preferences_type_idx" ON "guest_preferences" USING btree ("preference_type");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "dine_in_order_items" ADD CONSTRAINT "dine_in_order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
