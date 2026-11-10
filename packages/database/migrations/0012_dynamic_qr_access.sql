CREATE TYPE "public"."pass_alert_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."pass_alert_type" AS ENUM('missing_exit');--> statement-breakpoint
CREATE TYPE "public"."pass_status" AS ENUM('active', 'used', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."pass_type" AS ENUM('entry_only', 'entry_exit', 'entry_exit_recurring');--> statement-breakpoint
CREATE TYPE "public"."presence_state" AS ENUM('outside', 'inside');--> statement-breakpoint
CREATE TYPE "public"."scan_action" AS ENUM('entry', 'exit');--> statement-breakpoint
CREATE TYPE "public"."scan_result" AS ENUM('authorized', 'denied');--> statement-breakpoint
CREATE TYPE "public"."scan_status" AS ENUM('pending', 'confirmed', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "access_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"location_unit_id" uuid NOT NULL,
	"structure_id" uuid NOT NULL,
	"created_by_person_id" uuid NOT NULL,
	"authorized_by_person_id" uuid NOT NULL,
	"authorized_by_delegation_id" uuid,
	"visitor_first_name" varchar(120) NOT NULL,
	"visitor_last_name" varchar(120) NOT NULL,
	"visitor_document" varchar(50) NOT NULL,
	"has_vehicle" boolean DEFAULT false NOT NULL,
	"vehicle_plate" varchar(20),
	"type" "pass_type" NOT NULL,
	"valid_from" timestamp with time zone NOT NULL,
	"valid_until" timestamp with time zone NOT NULL,
	"allowed_days" jsonb,
	"time_from" time,
	"time_to" time,
	"status" "pass_status" DEFAULT 'active' NOT NULL,
	"presence_state" "presence_state" DEFAULT 'outside' NOT NULL,
	"link_token_hash" char(64) NOT NULL,
	"device_key_hash" char(64),
	"link_expires_at" timestamp with time zone NOT NULL,
	"pin_hash" text,
	"pin_enabled" boolean DEFAULT false NOT NULL,
	"pin_failed_attempts" integer DEFAULT 0 NOT NULL,
	"pin_locked_until" timestamp with time zone,
	"bound_at" timestamp with time zone,
	"entry_at" timestamp with time zone,
	"exit_at" timestamp with time zone,
	"entry_count" integer DEFAULT 0 NOT NULL,
	"exit_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pass_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pass_id" uuid NOT NULL,
	"community_id" uuid NOT NULL,
	"type" "pass_alert_type" NOT NULL,
	"status" "pass_alert_status" DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_person_id" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pass_scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pass_id" uuid NOT NULL,
	"guard_person_id" uuid NOT NULL,
	"guard_account_id" uuid,
	"community_id" uuid NOT NULL,
	"location_unit_id" uuid NOT NULL,
	"structure_id" uuid NOT NULL,
	"visitor_first_name" varchar(120) NOT NULL,
	"visitor_last_name" varchar(120) NOT NULL,
	"visitor_document" varchar(50) NOT NULL,
	"vehicle_plate" varchar(20),
	"action" "scan_action" NOT NULL,
	"result" "scan_result" DEFAULT 'authorized' NOT NULL,
	"reason" text,
	"token_jti" uuid NOT NULL,
	"status" "scan_status" DEFAULT 'pending' NOT NULL,
	"scanned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "outbox_events" ADD COLUMN "topic" varchar(20) DEFAULT 'events' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_passes" ADD CONSTRAINT "access_passes_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_passes" ADD CONSTRAINT "access_passes_location_unit_id_location_units_id_fk" FOREIGN KEY ("location_unit_id") REFERENCES "public"."location_units"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_passes" ADD CONSTRAINT "access_passes_structure_id_location_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."location_structures"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_passes" ADD CONSTRAINT "access_passes_created_by_person_id_people_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_passes" ADD CONSTRAINT "access_passes_authorized_by_person_id_people_id_fk" FOREIGN KEY ("authorized_by_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_alerts" ADD CONSTRAINT "pass_alerts_pass_id_access_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."access_passes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_alerts" ADD CONSTRAINT "pass_alerts_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_alerts" ADD CONSTRAINT "pass_alerts_resolved_by_person_id_people_id_fk" FOREIGN KEY ("resolved_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_scans" ADD CONSTRAINT "pass_scans_pass_id_access_passes_id_fk" FOREIGN KEY ("pass_id") REFERENCES "public"."access_passes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_scans" ADD CONSTRAINT "pass_scans_guard_person_id_people_id_fk" FOREIGN KEY ("guard_person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_scans" ADD CONSTRAINT "pass_scans_guard_account_id_accounts_id_fk" FOREIGN KEY ("guard_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_scans" ADD CONSTRAINT "pass_scans_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_scans" ADD CONSTRAINT "pass_scans_location_unit_id_location_units_id_fk" FOREIGN KEY ("location_unit_id") REFERENCES "public"."location_units"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pass_scans" ADD CONSTRAINT "pass_scans_structure_id_location_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."location_structures"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "access_pass_link_token_hash_idx" ON "access_passes" USING btree ("link_token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_pass_community_status_idx" ON "access_passes" USING btree ("community_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_pass_location_unit_created_idx" ON "access_passes" USING btree ("location_unit_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "access_pass_active_valid_until_idx" ON "access_passes" USING btree ("valid_until") WHERE "access_passes"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pass_alert_open_idx" ON "pass_alerts" USING btree ("pass_id","type") WHERE "pass_alerts"."status" = 'open';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pass_scan_token_jti_idx" ON "pass_scans" USING btree ("token_jti");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pass_scan_pass_scanned_idx" ON "pass_scans" USING btree ("pass_id","scanned_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pass_scan_community_scanned_idx" ON "pass_scans" USING btree ("community_id","scanned_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pass_scan_status_scanned_idx" ON "pass_scans" USING btree ("status","scanned_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_units_community_idx" ON "location_units" USING btree ("community_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_units_structure_idx" ON "location_units" USING btree ("structure_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_units_parent_idx" ON "location_units" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbox_topic_status_available_idx" ON "outbox_events" USING btree ("topic","status","available_at");