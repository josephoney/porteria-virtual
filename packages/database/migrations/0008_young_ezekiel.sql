CREATE TYPE "public"."asset_kind" AS ENUM('organization_logo', 'community_logo');--> statement-breakpoint
CREATE TYPE "public"."community_type" AS ENUM('conjunto', 'condominio', 'club', 'hotel', 'edificio', 'otro');--> statement-breakpoint
CREATE TYPE "public"."person_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"community_id" uuid,
	"kind" "asset_kind" NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"checksum" varchar(128),
	"created_by_person_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" varchar(120) NOT NULL,
	"last_name" varchar(120) DEFAULT '' NOT NULL,
	"document_type" varchar(30),
	"document_number" varchar(50),
	"phone" varchar(30),
	"contact_email" varchar(255),
	"status" "person_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "phone" varchar(30);--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "type" "community_type" DEFAULT 'conjunto' NOT NULL;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "type_label" varchar(100);--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "longitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "logo_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "communities" ADD COLUMN "welcome_message" text;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "location_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "person_id" uuid;--> statement-breakpoint
ALTER TABLE "memberships" ADD COLUMN "location_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "nit" varchar(30);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "phone" varchar(30);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "address" varchar(500);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "legal_representative_person_id" uuid;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "logo_asset_id" uuid;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "welcome_message" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "profile_completed_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_person_id_people_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_email_idx" ON "accounts" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_person_idx" ON "accounts" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_organization_idx" ON "assets" USING btree ("organization_id","kind");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assets_community_idx" ON "assets" USING btree ("community_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "people_document_type_number_idx" ON "people" USING btree ("document_type","document_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "people_contact_email_idx" ON "people" USING btree ("contact_email");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_location_unit_id_location_units_id_fk" FOREIGN KEY ("location_unit_id") REFERENCES "public"."location_units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "memberships" ADD CONSTRAINT "memberships_location_unit_id_location_units_id_fk" FOREIGN KEY ("location_unit_id") REFERENCES "public"."location_units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "organizations" ADD CONSTRAINT "organizations_legal_representative_person_id_people_id_fk" FOREIGN KEY ("legal_representative_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_person_idx" ON "memberships" USING btree ("person_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_location_unit_idx" ON "memberships" USING btree ("location_unit_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "organizations_nit_idx" ON "organizations" USING btree ("nit");--> statement-breakpoint
INSERT INTO "people" ("first_name", "last_name", "contact_email", "status", "created_at", "updated_at")
SELECT
  split_part("name", ' ', 1),
  NULLIF(substring("name" from position(' ' in "name") + 1), ''),
  "email",
  'active',
  "created_at",
  "updated_at"
FROM "users"
WHERE NOT EXISTS (
  SELECT 1 FROM "people" p WHERE p."contact_email" = "users"."email"
);
--> statement-breakpoint
INSERT INTO "accounts" ("person_id", "email", "password_hash", "active", "is_platform_admin", "created_at", "updated_at")
SELECT p."id", u."email", u."password_hash", u."active", u."is_platform_admin", u."created_at", u."updated_at"
FROM "users" u
JOIN "people" p ON p."contact_email" = u."email"
WHERE NOT EXISTS (
  SELECT 1 FROM "accounts" a WHERE a."email" = u."email"
);
--> statement-breakpoint
UPDATE "memberships" m
SET "person_id" = p."id"
FROM "users" u
JOIN "people" p ON p."contact_email" = u."email"
WHERE m."user_id" = u."id" AND m."person_id" IS NULL;
--> statement-breakpoint
UPDATE "memberships" m
SET "location_unit_id" = lu."id"
FROM "units" u
JOIN "location_units" lu ON lu."id" = u."id"
WHERE m."unit_id" = u."id" AND m."location_unit_id" IS NULL;
--> statement-breakpoint
UPDATE "memberships" m
SET "location_unit_id" = lu."id"
FROM "units" u
JOIN "location_units" lu ON lu."community_id" = u."community_id" AND lu."code" = u."code"
WHERE m."unit_id" = u."id" AND m."location_unit_id" IS NULL;
--> statement-breakpoint
UPDATE "invitations" i
SET "location_unit_id" = lu."id"
FROM "units" u
JOIN "location_units" lu ON lu."id" = u."id"
WHERE i."unit_id" = u."id" AND i."location_unit_id" IS NULL;
--> statement-breakpoint
UPDATE "invitations" i
SET "location_unit_id" = lu."id"
FROM "units" u
JOIN "location_units" lu ON lu."community_id" = u."community_id" AND lu."code" = u."code"
WHERE i."unit_id" = u."id" AND i."location_unit_id" IS NULL;