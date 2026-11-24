-- Origen de cada escaneo de pase: QR o documento de identidad.
--
-- La migración se puede volver a ejecutar sin efectos laterales: el tipo y la
-- columna sólo se crean si faltan y el backfill sólo toca filas que todavía
-- están en `qr`.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'scan_origin'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "public"."scan_origin" AS ENUM('qr', 'document');
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "pass_scans" ADD COLUMN IF NOT EXISTS "origin" "scan_origin" DEFAULT 'qr' NOT NULL;
--> statement-breakpoint

-- Corrige los ingresos por documento que quedaron registrados en el payload
-- del evento. El evento guarda el id del escaneo en `metadata.scanId`; no se
-- inventan escaneos para entradas que no tienen fila en `pass_scans`.
UPDATE "pass_scans" ps
SET "origin" = 'document'
FROM "events" e
WHERE e."metadata" ->> 'source' = 'manual_identity'
  AND e."metadata" ->> 'scanId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND (e."metadata" ->> 'scanId')::uuid = ps."id"
  AND ps."origin" IS DISTINCT FROM 'document';
