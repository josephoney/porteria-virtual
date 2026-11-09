CREATE TYPE "public"."location_structure_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."location_unit_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."section_type" AS ENUM('tower', 'interior', 'building', 'zone', 'block', 'sector', 'floor', 'house', 'lot', 'commercial', 'other');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "location_structures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"level_count" integer DEFAULT 3 NOT NULL,
	"level_1_name" varchar(100) DEFAULT 'Sección' NOT NULL,
	"level_2_name" varchar(100),
	"level_3_name" varchar(100),
	"status" "location_structure_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "location_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"community_id" uuid NOT NULL,
	"structure_id" uuid NOT NULL,
	"parent_id" uuid,
	"level_position" integer NOT NULL,
	"name" varchar(255) NOT NULL,
	"code" varchar(100),
	"section_type" "section_type",
	"section_type_label" varchar(100),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "location_unit_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "location_structures" ADD CONSTRAINT "location_structures_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "location_units" ADD CONSTRAINT "location_units_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "location_units" ADD CONSTRAINT "location_units_structure_id_location_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."location_structures"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "location_units" ADD CONSTRAINT "location_units_parent_id_location_units_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."location_units"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "location_units_structure_parent_code_idx" ON "location_units" USING btree ("structure_id","parent_id","code");
--> statement-breakpoint

-- Migración de buildings/units a la jerarquía configurable.
INSERT INTO location_structures (
  community_id, name, level_count, level_1_name, level_2_name, level_3_name, status
)
SELECT c.id, 'Estructura principal', 3, 'Sección', 'Piso', 'Unidad', 'active'
FROM communities c
WHERE NOT EXISTS (
  SELECT 1 FROM location_structures ls
  WHERE ls.community_id = c.id AND ls.name = 'Estructura principal'
);
--> statement-breakpoint

INSERT INTO location_units (
  id, community_id, structure_id, parent_id, level_position, name, code,
  section_type, section_type_label, status
)
SELECT b.id, b.community_id, ls.id, NULL, 1, b.name, b.code, 'building', NULL, 'active'
FROM buildings b
JOIN location_structures ls
  ON ls.community_id = b.community_id AND ls.name = 'Estructura principal'
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO location_units (
  id, community_id, structure_id, parent_id, level_position, name, code,
  section_type, section_type_label, status
)
SELECT gen_random_uuid(), c.id, ls.id, NULL, 1, 'Sin sección', NULL,
  'other', 'Sin sección', 'active'
FROM communities c
JOIN location_structures ls
  ON ls.community_id = c.id AND ls.name = 'Estructura principal'
WHERE EXISTS (
  SELECT 1 FROM units u WHERE u.community_id = c.id AND u.building_id IS NULL
)
AND NOT EXISTS (
  SELECT 1 FROM location_units lu
  WHERE lu.community_id = c.id AND lu.level_position = 1 AND lu.name = 'Sin sección'
);
--> statement-breakpoint

INSERT INTO location_units (
  id, community_id, structure_id, parent_id, level_position, name, code, status
)
SELECT gen_random_uuid(), u.community_id, ls.id, u.building_id, 2,
  'Piso ' || COALESCE(u.floor, 0)::text, NULL, 'active'
FROM (
  SELECT DISTINCT community_id, building_id, COALESCE(floor, 0) AS floor
  FROM units
  WHERE building_id IS NOT NULL
) u
JOIN location_structures ls
  ON ls.community_id = u.community_id AND ls.name = 'Estructura principal'
WHERE NOT EXISTS (
  SELECT 1 FROM location_units lu
  WHERE lu.parent_id = u.building_id
    AND lu.level_position = 2
    AND lu.name = 'Piso ' || u.floor::text
);
--> statement-breakpoint

INSERT INTO location_units (
  id, community_id, structure_id, parent_id, level_position, name, code, status
)
SELECT gen_random_uuid(), u.community_id, ls.id, fallback.id, 2, 'Sin piso', NULL, 'active'
FROM (
  SELECT DISTINCT community_id FROM units WHERE building_id IS NULL
) u
JOIN location_structures ls
  ON ls.community_id = u.community_id AND ls.name = 'Estructura principal'
JOIN location_units fallback
  ON fallback.community_id = u.community_id
  AND fallback.level_position = 1
  AND fallback.name = 'Sin sección'
WHERE NOT EXISTS (
  SELECT 1 FROM location_units lu
  WHERE lu.parent_id = fallback.id AND lu.level_position = 2 AND lu.name = 'Sin piso'
);
--> statement-breakpoint

INSERT INTO location_units (
  id, community_id, structure_id, parent_id, level_position, name, code,
  metadata, status
)
SELECT u.id, u.community_id, ls.id, floor_node.id, 3, u.code, u.code,
  jsonb_build_object('legacyFloor', u.floor, 'legacyType', u.type),
  u.status::text::location_unit_status
FROM units u
JOIN location_structures ls
  ON ls.community_id = u.community_id AND ls.name = 'Estructura principal'
JOIN location_units floor_node
  ON floor_node.parent_id = u.building_id
  AND floor_node.level_position = 2
  AND floor_node.name = 'Piso ' || COALESCE(u.floor, 0)::text
WHERE u.building_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

INSERT INTO location_units (
  id, community_id, structure_id, parent_id, level_position, name, code,
  metadata, status
)
SELECT u.id, u.community_id, ls.id, floor_node.id, 3, u.code, u.code,
  jsonb_build_object('legacyFloor', u.floor, 'legacyType', u.type),
  u.status::text::location_unit_status
FROM units u
JOIN location_structures ls
  ON ls.community_id = u.community_id AND ls.name = 'Estructura principal'
JOIN location_units fallback
  ON fallback.community_id = u.community_id
  AND fallback.level_position = 1
  AND fallback.name = 'Sin sección'
JOIN location_units floor_node
  ON floor_node.parent_id = fallback.id
  AND floor_node.level_position = 2
  AND floor_node.name = 'Sin piso'
WHERE u.building_id IS NULL
ON CONFLICT (id) DO NOTHING;
