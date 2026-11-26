-- Invitaciones multi-unidad: una invitación puede cubrir varias unidades de la
-- misma comunidad. La unidad principal sigue viviendo en invitations.location_unit_id.

CREATE TABLE IF NOT EXISTS "invitation_units" (
  "invitation_id" uuid NOT NULL,
  "location_unit_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "invitation_units_invitation_id_location_unit_id_pk"
    PRIMARY KEY ("invitation_id", "location_unit_id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invitation_units_invitation_id_fk'
  ) THEN
    ALTER TABLE "invitation_units"
      ADD CONSTRAINT "invitation_units_invitation_id_fk"
      FOREIGN KEY ("invitation_id") REFERENCES "invitations"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'invitation_units_location_unit_id_fk'
  ) THEN
    ALTER TABLE "invitation_units"
      ADD CONSTRAINT "invitation_units_location_unit_id_fk"
      FOREIGN KEY ("location_unit_id") REFERENCES "location_units"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "invitation_units_location_unit_idx"
  ON "invitation_units" ("location_unit_id");

-- Backfill: cada invitación existente con unidad principal pasa a tener su fila.
INSERT INTO "invitation_units" ("invitation_id", "location_unit_id")
SELECT "id", "location_unit_id"
FROM "invitations"
WHERE "location_unit_id" IS NOT NULL
ON CONFLICT DO NOTHING;

-- Unicidad por unidad lógica en memberships. Se intenta crear; si la base ya
-- tiene duplicados, la migración no se cae y deja el aviso en el log.
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS "memberships_person_location_unit_idx"
      ON "memberships" ("person_id", "location_unit_id", "role")
      WHERE "location_unit_id" IS NOT NULL;
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'memberships_person_location_unit_idx omitido: hay membresias duplicadas por persona, unidad y rol. Limpiar duplicados y crear el indice a mano.';
  END;
END $$;

-- Evita invitaciones pendientes repetidas para el mismo correo y unidad.
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS "invitations_pending_unit_idx"
      ON "invitations" ("email", "community_id", "location_unit_id")
      WHERE "status" = 'pending' AND "location_unit_id" IS NOT NULL;
  EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'invitations_pending_unit_idx omitido: hay invitaciones pendientes duplicadas. Revocar o aceptar las repetidas y crear el indice a mano.';
  END;
END $$;

-- Rollback (ejecutar a mano si hay que volver atras):
--   DROP INDEX IF EXISTS "invitations_pending_unit_idx";
--   DROP INDEX IF EXISTS "memberships_person_location_unit_idx";
--   DROP TABLE IF EXISTS "invitation_units";
