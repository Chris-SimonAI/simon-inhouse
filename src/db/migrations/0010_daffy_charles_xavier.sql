CREATE TYPE "public"."menu_status" AS ENUM('pending', 'approved', 'archived');--> statement-breakpoint
ALTER TABLE "dine_in_restaurants" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "menus" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "menus" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_groups" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "original_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "menu_items" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "modifier_options" ADD COLUMN "original_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "modifier_options" ADD COLUMN "status" "menu_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX "dine_in_restaurants_status_index" ON "dine_in_restaurants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "menus_status_index" ON "menus" USING btree ("status");--> statement-breakpoint
CREATE INDEX "menus_version_index" ON "menus" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "menus_one_approved_per_restaurant" ON "menus" USING btree ("restaurant_id") WHERE "menus"."status" = 'approved';--> statement-breakpoint
CREATE INDEX "menu_groups_status_index" ON "menu_groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "menu_items_status_index" ON "menu_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "modifier_groups_status_index" ON "modifier_groups" USING btree ("status");--> statement-breakpoint
CREATE INDEX "modifier_options_status_index" ON "modifier_options" USING btree ("status");

-- 0) Backfill dine-in restaurants: mark existing rows as approved
UPDATE "dine_in_restaurants"
SET "status" = 'approved'::menu_status
WHERE "status" IS NOT NULL;--> statement-breakpoint

-- DATA BACKFILL: mark existing data as approved for the latest menu per restaurant,
-- and propagate 'approved' to its child entities. Also backfill original_price.

-- 1) Choose one latest menu per restaurant (by highest id) to approve;
--    archive the rest to satisfy the unique approved-per-restaurant constraint.
WITH latest_menu AS (
  SELECT DISTINCT ON ("restaurant_id") id
  FROM "menus"
  ORDER BY "restaurant_id", id DESC
)
UPDATE "menus" AS m
SET "status" = CASE
  WHEN m.id IN (SELECT id FROM latest_menu) THEN 'approved'::menu_status
  ELSE 'archived'::menu_status
END
WHERE m."status" IS NOT NULL;--> statement-breakpoint

-- 2) Propagate 'approved' to child entities of approved menus
UPDATE "menu_groups" mg
SET "status" = 'approved'::menu_status
WHERE mg."menu_id" IN (SELECT id FROM "menus" WHERE "status" = 'approved'::menu_status);--> statement-breakpoint

UPDATE "menu_items" mi
SET "status" = 'approved'::menu_status
WHERE mi."menu_group_id" IN (
  SELECT id FROM "menu_groups" WHERE "status" = 'approved'::menu_status
);--> statement-breakpoint

UPDATE "modifier_groups" g
SET "status" = 'approved'::menu_status
WHERE g."menu_item_id" IN (
  SELECT id FROM "menu_items" WHERE "status" = 'approved'::menu_status
);--> statement-breakpoint

UPDATE "modifier_options" mo
SET "status" = 'approved'::menu_status
WHERE mo."modifier_group_id" IN (
  SELECT id FROM "modifier_groups" WHERE "status" = 'approved'::menu_status
);--> statement-breakpoint

-- 3) Backfill original_price from price where missing
UPDATE "menu_items"
SET "original_price" = "price"
WHERE "original_price" IS NULL AND "price" IS NOT NULL;--> statement-breakpoint

UPDATE "modifier_options"
SET "original_price" = "price"
WHERE "original_price" IS NULL AND "price" IS NOT NULL;--> statement-breakpoint
