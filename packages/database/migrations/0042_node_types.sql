-- Tipo de nodo por nivel.
--
-- `section_type` era un enum que solo cubría el nivel 1 y que obligaba a una
-- migración por cada valor nuevo. El tipo pasa a texto con catálogo en la app:
-- el nivel 1 usa el catálogo de contenedores y los niveles 2 y 3 el de espacios.
--
-- Es aditivo e idempotente: las columnas nuevas son nullable y el backfill solo
-- copia lo que ya existía, así que ningún nodo cambia de comportamiento.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'location_units'
      AND column_name = 'node_type'
  ) THEN
    ALTER TABLE "location_units" ADD COLUMN "node_type" varchar(60);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'location_units'
      AND column_name = 'node_type_label'
  ) THEN
    ALTER TABLE "location_units" ADD COLUMN "node_type_label" varchar(100);
  END IF;
END $$;

-- Backfill desde el enum legado. El WHERE evita repetirlo en una segunda corrida
-- y evita pisar los tipos que ya se hayan guardado con las columnas nuevas.
UPDATE "location_units"
SET "node_type" = "section_type"::text
WHERE "node_type" IS NULL
  AND "section_type" IS NOT NULL;

UPDATE "location_units"
SET "node_type_label" = "section_type_label"
WHERE "node_type_label" IS NULL
  AND "section_type_label" IS NOT NULL;

-- Rollback (ejecutar a mano si hay que volver atrás):
--   ALTER TABLE "location_units" DROP COLUMN IF EXISTS "node_type";
--   ALTER TABLE "location_units" DROP COLUMN IF EXISTS "node_type_label";
