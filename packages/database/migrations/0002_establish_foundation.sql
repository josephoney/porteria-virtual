-- 0002_establish_foundation
-- Multi-tenant foundation: organizations -> communities -> buildings -> units,
-- memberships, and community scoping.
--
-- ROLLBACK (dev only, restore a backup if possible):
--   UPDATE refresh_tokens SET revoked = false; -- not reliable, restore backup
--   ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
--   ALTER TABLE users ADD COLUMN role varchar(20);
--   ALTER TABLE users ADD COLUMN organization_id uuid;
--   ALTER TABLE users ADD COLUMN location_id uuid;
--   ALTER TABLE users DROP COLUMN is_platform_admin;
--   ALTER TABLE guard_rounds RENAME COLUMN community_id TO location_id;
--   ALTER TABLE events RENAME COLUMN community_id TO location_id;
--   ALTER TABLE calls DROP COLUMN community_id;
--   ALTER TABLE kiosks DROP COLUMN community_id;
--   ALTER TABLE access_points RENAME COLUMN community_id TO location_id;
--   ALTER TABLE access_points DROP COLUMN fail_policy, DROP COLUMN direction;
--   DROP TABLE memberships, units, buildings;
--   ALTER TABLE communities DROP COLUMN status;
--   ALTER TABLE communities RENAME TO locations;
--   DROP TYPE membership_status, membership_role, unit_status, unit_type,
--     community_status, access_fail_policy, access_direction;

CREATE TYPE "public"."community_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."unit_type" AS ENUM('apartment', 'house', 'office', 'parking', 'storage');--> statement-breakpoint
CREATE TYPE "public"."unit_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."membership_role" AS ENUM('org_admin', 'community_admin', 'operator', 'guard', 'owner', 'tenant', 'resident', 'staff');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."access_fail_policy" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."access_direction" AS ENUM('entry', 'exit', 'both');--> statement-breakpoint

ALTER TABLE "locations" RENAME TO "communities";--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "status" "community_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint

CREATE TABLE "buildings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(50),
	"floors" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"building_id" uuid,
	"code" varchar(50) NOT NULL,
	"floor" integer,
	"type" "unit_type" DEFAULT 'apartment' NOT NULL,
	"status" "unit_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"community_id" uuid,
	"unit_id" uuid,
	"role" "membership_role" NOT NULL,
	"status" "membership_status" DEFAULT 'active' NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "buildings" ADD CONSTRAINT "buildings_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "units" ADD CONSTRAINT "units_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "units" ADD CONSTRAINT "units_building_id_buildings_id_fk" FOREIGN KEY ("building_id") REFERENCES "public"."buildings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE UNIQUE INDEX "buildings_community_code_idx" ON "buildings" USING btree ("community_id", "code");--> statement-breakpoint
CREATE UNIQUE INDEX "units_community_code_idx" ON "units" USING btree ("community_id", "code");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_unique_idx" ON "memberships" USING btree ("user_id", "organization_id", "community_id", "unit_id", "role") NULLS NOT DISTINCT;--> statement-breakpoint
CREATE INDEX "memberships_user_idx" ON "memberships" USING btree ("user_id", "status");--> statement-breakpoint
CREATE INDEX "memberships_org_idx" ON "memberships" USING btree ("organization_id", "status");--> statement-breakpoint
CREATE INDEX "memberships_community_idx" ON "memberships" USING btree ("community_id", "status");--> statement-breakpoint

ALTER TABLE "access_points" RENAME COLUMN "location_id" TO "community_id";--> statement-breakpoint
ALTER TABLE "access_points" ADD COLUMN "fail_policy" "access_fail_policy" DEFAULT 'closed' NOT NULL;--> statement-breakpoint
ALTER TABLE "access_points" ADD COLUMN "direction" "access_direction" DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE "access_points" DROP CONSTRAINT IF EXISTS "access_points_location_id_locations_id_fk";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_points" ADD CONSTRAINT "access_points_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "kiosks" ADD COLUMN "community_id" uuid;--> statement-breakpoint
UPDATE "kiosks" k
SET "community_id" = ap."community_id"
FROM "access_points" ap
WHERE k."access_point_id" = ap."id";--> statement-breakpoint
UPDATE "kiosks"
SET "community_id" = (SELECT "id" FROM "communities" ORDER BY "created_at" LIMIT 1)
WHERE "community_id" IS NULL;--> statement-breakpoint
ALTER TABLE "kiosks" ALTER COLUMN "community_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "calls" ADD COLUMN "community_id" uuid;--> statement-breakpoint
UPDATE "calls" c
SET "community_id" = k."community_id"
FROM "kiosks" k
WHERE c."kiosk_id" = k."id";--> statement-breakpoint
ALTER TABLE "calls" ALTER COLUMN "community_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calls" ADD CONSTRAINT "calls_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "events" RENAME COLUMN "location_id" TO "community_id";--> statement-breakpoint
ALTER TABLE "events" DROP CONSTRAINT IF EXISTS "events_location_id_locations_id_fk";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "guard_rounds" RENAME COLUMN "location_id" TO "community_id";--> statement-breakpoint
ALTER TABLE "guard_rounds" DROP CONSTRAINT IF EXISTS "guard_rounds_location_id_locations_id_fk";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_rounds" ADD CONSTRAINT "guard_rounds_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "is_platform_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint

INSERT INTO "memberships" ("user_id", "organization_id", "community_id", "role", "status")
SELECT
	u."id",
	u."organization_id",
	u."location_id",
	CASE u."role"
		WHEN 'admin' THEN 'org_admin'::"membership_role"
		WHEN 'operator' THEN 'operator'::"membership_role"
		WHEN 'guard' THEN 'guard'::"membership_role"
		WHEN 'resident' THEN 'resident'::"membership_role"
		ELSE 'staff'::"membership_role"
	END,
	'active'::"membership_status"
FROM "users" u
WHERE u."organization_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint

DROP INDEX IF EXISTS "users_email_org_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "organization_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "location_id";--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_email_unique" UNIQUE("email");--> statement-breakpoint

UPDATE "refresh_tokens" SET "revoked" = true;
