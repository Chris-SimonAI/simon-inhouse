CREATE TYPE "public"."menu_status" AS ENUM('pending', 'approved', 'archived');--> statement-breakpoint
ALTER TABLE "dine_in_restaurants" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "menus" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "menus" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "menus" ADD COLUMN "approved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "menu_groups" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "original_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "modifier_options" ADD COLUMN "original_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "modifier_options" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX "dine_in_restaurants_status_index" ON "dine_in_restaurants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "menus_status_index" ON "menus" USING btree ("status");--> statement-breakpoint
CREATE INDEX "menus_version_index" ON "menus" USING btree ("version");--> statement-breakpoint
CREATE INDEX "menu_groups_status_index" ON "menu_groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "menu_items_status_index" ON "menu_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "modifier_groups_status_index" ON "modifier_groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "modifier_options_status_index" ON "modifier_options" USING btree ("status");