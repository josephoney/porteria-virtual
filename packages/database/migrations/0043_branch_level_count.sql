-- Profundidad por rama.
--
-- Una comunidad puede tener ramas de 2 y de 3 niveles: el hotel usa los tres,
-- las torres de apartamentos solo dos. `location_structures.level_count` pasa a
-- ser el máximo de la estructura y cada nodo guarda hasta qué nivel llega su
-- rama en `branch_level_count`.
--
-- El backfill deja el valor actual de la estructura, así que ningún nodo cambia
-- de comportamiento: la hoja sigue siendo el mismo nivel que antes.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'location_units'
      AND column_name = 'branch_level_count'
  ) THEN
    ALTER TABLE "location_units" ADD COLUMN "branch_level_count" smallint;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'location_units_branch_level_count_check'
  ) THEN
    ALTER TABLE "location_units"
      ADD CONSTRAINT "location_units_branch_level_count_check"
      CHECK ("branch_level_count" IS NULL OR "branch_level_count" BETWEEN 1 AND 3);
  END IF;
END $$;

UPDATE "location_units" AS u
SET "branch_level_count" = s."level_count"
FROM "location_structures" AS s
WHERE u."structure_id" = s."id"
  AND u."branch_level_count" IS NULL;

CREATE INDEX IF NOT EXISTS "location_units_branch_level_idx"
  ON "location_units" ("structure_id", "branch_level_count");

-- Rollback (ejecutar a mano si hay que volver atrás):
--   DROP INDEX IF EXISTS "location_units_branch_level_idx";
--   ALTER TABLE "location_units" DROP CONSTRAINT IF EXISTS "location_units_branch_level_count_check";
--   ALTER TABLE "location_units" DROP COLUMN IF EXISTS "branch_level_count";
