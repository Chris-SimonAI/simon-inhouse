ALTER TYPE "public"."order_status" ADD VALUE 'failed';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'requested_to_toast';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'toast_ordered';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'toast_ok_capture_failed';--> statement-breakpoint
ALTER TYPE "public"."payment_status" ADD VALUE 'authorized' BEFORE 'succeeded';