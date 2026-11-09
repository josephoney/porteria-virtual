CREATE INDEX IF NOT EXISTS "location_units_community_idx" ON "location_units" USING btree ("community_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_units_structure_idx" ON "location_units" USING btree ("structure_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "location_units_parent_idx" ON "location_units" USING btree ("parent_id");
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "location_units" ADD CONSTRAINT "location_units_level_position_check" CHECK ("level_position" BETWEEN 1 AND 5);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "location_units" ADD CONSTRAINT "location_units_root_check" CHECK (("parent_id" IS NULL) = ("level_position" = 1));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "location_units" ADD CONSTRAINT "location_units_code_check" CHECK ("code" IS NULL OR length(trim("code")) > 0);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "location_units" ADD CONSTRAINT "location_units_other_label_check" CHECK ("section_type" IS DISTINCT FROM 'other' OR "section_type_label" IS NOT NULL);
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
