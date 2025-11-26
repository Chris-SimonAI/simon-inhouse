CREATE TYPE "public"."tip_payment_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "tips" ALTER COLUMN "payment_status" SET DEFAULT 'pending'::"public"."tip_payment_status";--> statement-breakpoint
ALTER TABLE "tips" ALTER COLUMN "payment_status" SET DATA TYPE "public"."tip_payment_status" USING "payment_status"::"public"."tip_payment_status";