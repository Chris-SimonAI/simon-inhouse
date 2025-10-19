ALTER TABLE "amenities" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
CREATE INDEX "amenities_embedding_idx" ON "amenities" USING ivfflat ("embedding" vector_l2_ops) WITH (lists=100);