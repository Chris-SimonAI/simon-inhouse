-- Convert user_id (legacy numeric) to text FK referencing user.id
ALTER TABLE "dine_in_orders" ADD COLUMN "user_id_new" text;

DO $$
DECLARE
  v_user_id text;
  v_orders_count bigint;
BEGIN
  SELECT count(*) INTO v_orders_count FROM "dine_in_orders";

  IF v_orders_count = 0 THEN
    -- Nothing to backfill when seeding from scratch; keep the column empty.
    RETURN;
  END IF;

  SELECT "id" INTO v_user_id FROM "user" ORDER BY "created_at" ASC LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found to backfill dine_in_orders.user_id';
  END IF;

  UPDATE "dine_in_orders"
  SET "user_id_new" = v_user_id
  WHERE "user_id_new" IS NULL;
END $$;

ALTER TABLE "dine_in_orders" ALTER COLUMN "user_id_new" SET NOT NULL;

ALTER TABLE "dine_in_orders" DROP COLUMN "user_id";
ALTER TABLE "dine_in_orders" RENAME COLUMN "user_id_new" TO "user_id";

ALTER TABLE "dine_in_orders" ADD CONSTRAINT "dine_in_orders_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "dine_in_restaurants" ADD COLUMN "show_tips" boolean DEFAULT true NOT NULL;