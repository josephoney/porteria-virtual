CREATE TYPE "public"."bitacora_entry_type" AS ENUM('pass_entry', 'pass_exit', 'pass_rejected', 'scan_denied', 'shift_start', 'shift_end', 'manual');--> statement-breakpoint
CREATE TYPE "public"."bitacora_source" AS ENUM('app', 'dashboard', 'system');--> statement-breakpoint
CREATE TYPE "public"."guard_shift_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bitacora_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"author_person_id" uuid,
	"author_account_id" uuid,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bitacora_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"access_point_id" uuid NOT NULL,
	"access_point_name" varchar(255) NOT NULL,
	"shift_id" uuid,
	"type" "bitacora_entry_type" NOT NULL,
	"source" "bitacora_source" DEFAULT 'app' NOT NULL,
	"author_person_id" uuid,
	"author_account_id" uuid,
	"pass_id" uuid,
	"pass_scan_id" uuid,
	"summary" varchar(500) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_shift_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"access_point_id" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"guard_person_id" uuid NOT NULL,
	"guard_account_id" uuid,
	"status" "guard_shift_status" DEFAULT 'open' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by_person_id" uuid,
	"closed_reason" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_points" ALTER COLUMN "gpio_pin" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "access_points" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "default_access_point_id" uuid;--> statement-breakpoint
ALTER TABLE "pass_scans" ADD COLUMN "shift_id" uuid;--> statement-breakpoint
ALTER TABLE "pass_scans" ADD COLUMN "access_point_id" uuid;--> statement-breakpoint
ALTER TABLE "pass_scans" ADD COLUMN "access_point_name" varchar(255);--> statement-breakpoint
ALTER TABLE "pass_scans" ADD COLUMN "confirmed_by_person_id" uuid;--> statement-breakpoint
ALTER TABLE "pass_scans" ADD COLUMN "confirmed_by_account_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_comments" ADD CONSTRAINT "bitacora_comments_entry_id_bitacora_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."bitacora_entries"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_comments" ADD CONSTRAINT "bitacora_comments_author_person_id_people_id_fk" FOREIGN KEY ("author_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_comments" ADD CONSTRAINT "bitacora_comments_author_account_id_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_access_point_id_access_points_id_fk" FOREIGN KEY ("access_point_id") REFERENCES "public"."access_points"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_shift_id_guard_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."guard_shifts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_author_person_id_people_id_fk" FOREIGN KEY ("author_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_author_account_id_accounts_id_fk" FOREIGN KEY ("author_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_pass_id_access_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."access_passes"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_pass_scan_id_pass_scans_id_fk" FOREIGN KEY ("pass_scan_id") REFERENCES "public"."pass_scans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_shift_segments" ADD CONSTRAINT "guard_shift_segments_shift_id_guard_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."guard_shifts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_shift_segments" ADD CONSTRAINT "guard_shift_segments_access_point_id_access_points_id_fk" FOREIGN KEY ("access_point_id") REFERENCES "public"."access_points"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_shifts" ADD CONSTRAINT "guard_shifts_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_shifts" ADD CONSTRAINT "guard_shifts_guard_person_id_people_id_fk" FOREIGN KEY ("guard_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_shifts" ADD CONSTRAINT "guard_shifts_guard_account_id_accounts_id_fk" FOREIGN KEY ("guard_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_shifts" ADD CONSTRAINT "guard_shifts_ended_by_person_id_people_id_fk" FOREIGN KEY ("ended_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bitacora_comment_entry_created_idx" ON "bitacora_comments" USING btree ("entry_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bitacora_place_created_idx" ON "bitacora_entries" USING btree ("community_id","access_point_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bitacora_shift_created_idx" ON "bitacora_entries" USING btree ("shift_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bitacora_pass_idx" ON "bitacora_entries" USING btree ("pass_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bitacora_type_created_idx" ON "bitacora_entries" USING btree ("type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guard_shift_segment_open_idx" ON "guard_shift_segments" USING btree ("shift_id") WHERE ended_at IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_shift_segment_access_started_idx" ON "guard_shift_segments" USING btree ("access_point_id","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_shift_segment_shift_started_idx" ON "guard_shift_segments" USING btree ("shift_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guard_shift_open_idx" ON "guard_shifts" USING btree ("guard_person_id") WHERE status = 'open';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_shift_community_status_idx" ON "guard_shifts" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_shift_guard_started_idx" ON "guard_shifts" USING btree ("guard_person_id","started_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_default_access_point_id_access_points_id_fk" FOREIGN KEY ("default_access_point_id") REFERENCES "public"."access_points"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_scans" ADD CONSTRAINT "pass_scans_shift_id_guard_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."guard_shifts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_scans" ADD CONSTRAINT "pass_scans_access_point_id_access_points_id_fk" FOREIGN KEY ("access_point_id") REFERENCES "public"."access_points"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_scans" ADD CONSTRAINT "pass_scans_confirmed_by_person_id_people_id_fk" FOREIGN KEY ("confirmed_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_scans" ADD CONSTRAINT "pass_scans_confirmed_by_account_id_accounts_id_fk" FOREIGN KEY ("confirmed_by_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "access_point_community_name_idx" ON "access_points" USING btree ("community_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_point_community_active_idx" ON "access_points" USING btree ("community_id","active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_default_access_point_idx" ON "memberships" USING btree ("default_access_point_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pass_scan_access_point_scanned_idx" ON "pass_scans" USING btree ("access_point_id","scanned_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pass_scan_shift_scanned_idx" ON "pass_scans" USING btree ("shift_id","scanned_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_bitacora_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'bitacora rows are immutable';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
DROP TRIGGER IF EXISTS bitacora_entries_no_update ON "bitacora_entries";--> statement-breakpoint
CREATE TRIGGER bitacora_entries_no_update BEFORE UPDATE ON "bitacora_entries" FOR EACH ROW EXECUTE FUNCTION prevent_bitacora_update();--> statement-breakpoint
DROP TRIGGER IF EXISTS bitacora_comments_no_update ON "bitacora_comments";--> statement-breakpoint
CREATE TRIGGER bitacora_comments_no_update BEFORE UPDATE ON "bitacora_comments" FOR EACH ROW EXECUTE FUNCTION prevent_bitacora_update();