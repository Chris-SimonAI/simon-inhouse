ALTER TABLE "qr_codes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "qr_codes" CASCADE;--> statement-breakpoint

ALTER TABLE "session" ALTER COLUMN "hotel_id" TYPE integer USING hotel_id::integer;--> statement-breakpoint

-- slug: add nullable, backfill, then enforce NOT NULL
ALTER TABLE "hotels" ADD COLUMN "slug" varchar(64);--> statement-breakpoint
UPDATE "hotels" SET "slug" = 'anza' WHERE "slug" IS NULL OR "slug" = '';--> statement-breakpoint
ALTER TABLE "hotels" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "session" ADD CONSTRAINT "session_hotel_id_hotels_id_fk"
  FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id")
  ON DELETE no action ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "session" DROP COLUMN "qr_id";--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "qr_code";
