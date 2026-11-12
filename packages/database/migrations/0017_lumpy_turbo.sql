ALTER TYPE "public"."section_type" ADD VALUE 'common_area' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "access_passes" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
ALTER TABLE "access_passes" ADD COLUMN "batch_label" varchar(80);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_pass_batch_idx" ON "access_passes" USING btree ("batch_id");