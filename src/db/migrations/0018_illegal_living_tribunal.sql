CREATE TABLE "guest_profiles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"name" varchar(255),
	"room_number" varchar(10),
	"dietary_preferences" text[] DEFAULT '{}',
	"allergies" text[] DEFAULT '{}',
	"favorite_cuisines" text[] DEFAULT '{}',
	"disliked_foods" text[] DEFAULT '{}',
	"notes" text,
	"hotel_id" bigint,
	"sms_thread_id" text,
	"has_been_introduced" boolean DEFAULT false NOT NULL,
	"last_order_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "guest_profiles_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "dine_in_orders" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "guest_profiles" ADD CONSTRAINT "guest_profiles_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;