ALTER TABLE "dine_in_restaurants" ADD COLUMN "business_hours" jsonb;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "is_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "modifier_options" ADD COLUMN "is_available" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "menu_items_is_available_index" ON "menu_items" USING btree ("is_available");--> statement-breakpoint
CREATE INDEX "modifier_options_is_available_index" ON "modifier_options" USING btree ("is_available");