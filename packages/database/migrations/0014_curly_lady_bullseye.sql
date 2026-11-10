ALTER TABLE "bitacora_entries" ADD COLUMN "destination_location_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "bitacora_entries" ADD COLUMN "destination_path" varchar(500);--> statement-breakpoint
ALTER TABLE "bitacora_entries" ADD COLUMN "authorized_by_person_id" uuid;--> statement-breakpoint
ALTER TABLE "bitacora_entries" ADD COLUMN "authorized_by_name" varchar(255);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_destination_location_unit_id_location_units_id_fk" FOREIGN KEY ("destination_location_unit_id") REFERENCES "public"."location_units"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bitacora_entries" ADD CONSTRAINT "bitacora_entries_authorized_by_person_id_people_id_fk" FOREIGN KEY ("authorized_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bitacora_destination_idx" ON "bitacora_entries" USING btree ("destination_location_unit_id");