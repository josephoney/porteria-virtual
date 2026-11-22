-- Las rondas y los residentes dejan de apuntar a `users` y pasan a apuntar a
-- la persona. Backfill: la persona se resuelve por la cuenta asociada al email
-- del usuario referenciado.
UPDATE guard_rounds gr
SET guard_person_id = a.person_id
FROM users u
JOIN accounts a ON a.email = u.email
WHERE gr.guard_id = u.id
  AND gr.guard_person_id IS NULL;
--> statement-breakpoint

ALTER TABLE "location_residents" ADD COLUMN "person_id" uuid;
--> statement-breakpoint
UPDATE location_residents lr
SET person_id = a.person_id
FROM users u
JOIN accounts a ON a.email = u.email
WHERE lr.user_id = u.id
  AND lr.person_id IS NULL;
--> statement-breakpoint

-- Guarda: abortar si quedarían rondas o residentes sin persona resuelta.
DO $$
DECLARE
  rondas_sin_persona integer;
  residentes_sin_persona integer;
BEGIN
  SELECT count(*) INTO rondas_sin_persona
  FROM guard_rounds
  WHERE guard_person_id IS NULL;

  SELECT count(*) INTO residentes_sin_persona
  FROM location_residents
  WHERE person_id IS NULL;

  IF rondas_sin_persona > 0 THEN
    RAISE EXCEPTION 'rondas sin persona: % filas no se pudieron mapear a people', rondas_sin_persona;
  END IF;

  IF residentes_sin_persona > 0 THEN
    RAISE EXCEPTION 'residentes sin persona: % filas no se pudieron mapear a people', residentes_sin_persona;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "guard_rounds" DROP CONSTRAINT "guard_rounds_guard_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "guard_rounds" DROP CONSTRAINT "guard_rounds_guard_person_id_people_id_fk";
--> statement-breakpoint
ALTER TABLE "guard_rounds" DROP COLUMN IF EXISTS "guard_id";
--> statement-breakpoint
ALTER TABLE "guard_rounds" ALTER COLUMN "guard_person_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_rounds" ADD CONSTRAINT "guard_rounds_guard_person_id_people_id_fk" FOREIGN KEY ("guard_person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

DROP INDEX IF EXISTS "location_residents_unit_user_relationship_idx";
--> statement-breakpoint
ALTER TABLE "location_residents" ALTER COLUMN "person_id" SET NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "location_residents" ADD CONSTRAINT "location_residents_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "location_residents" DROP CONSTRAINT "location_residents_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "location_residents" DROP COLUMN IF EXISTS "user_id";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "location_residents_unit_person_relationship_idx" ON "location_residents" USING btree ("location_unit_id","person_id","relationship");
