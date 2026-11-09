CREATE TYPE "public"."location_resident_relationship" AS ENUM('owner', 'tenant', 'resident', 'family', 'staff');--> statement-breakpoint
CREATE TYPE "public"."location_resident_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "location_residents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_unit_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"relationship" "location_resident_relationship" NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"status" "location_resident_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "location_residents" ADD CONSTRAINT "location_residents_location_unit_id_location_units_id_fk" FOREIGN KEY ("location_unit_id") REFERENCES "public"."location_units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "location_residents" ADD CONSTRAINT "location_residents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "location_residents_unit_user_relationship_idx" ON "location_residents" USING btree ("location_unit_id","user_id","relationship");
--> statement-breakpoint

-- Migrar ocupantes existentes desde memberships.unit_id a location_residents.
INSERT INTO location_residents (
  location_unit_id, user_id, relationship, valid_from, status
)
SELECT
  m.unit_id,
  m.user_id,
  CASE
    WHEN m.role = 'owner' THEN 'owner'::location_resident_relationship
    WHEN m.role = 'tenant' THEN 'tenant'::location_resident_relationship
    WHEN m.role = 'resident' THEN 'resident'::location_resident_relationship
    ELSE 'staff'::location_resident_relationship
  END,
  CURRENT_DATE,
  'active'
FROM memberships m
WHERE m.unit_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM location_units lu WHERE lu.id = m.unit_id)
ON CONFLICT (location_unit_id, user_id, relationship) DO NOTHING;
