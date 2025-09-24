CREATE TABLE "tips" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"hotel_id" bigint NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"payment_method" varchar(50) NOT NULL,
	"payment_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"transaction_id" varchar(255),
	"guest_name" varchar(255),
	"guest_email" varchar(255),
	"room_number" varchar(20),
	"message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tips" ADD CONSTRAINT "tips_hotel_id_hotels_id_fk" FOREIGN KEY ("hotel_id") REFERENCES "public"."hotels"("id") ON DELETE no action ON UPDATE no action;