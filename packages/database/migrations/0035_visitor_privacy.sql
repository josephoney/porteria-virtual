-- Privacidad del visitante: ventana en días, consentimiento y preservación.
--
-- Tres cambios que van juntos porque se explican entre sí: la identidad se
-- guarda poco tiempo, el visitante tiene que poder demostrar que autorizó, y la
-- organización puede congelar un rango puntual cuando investiga un incidente.

-- 1. La ventana pasa de meses a días. El valor anterior se traduce al rango
--    nuevo (30, 60 o 90) para no cambiar el comportamiento por sorpresa.
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "retention_days" integer DEFAULT 30 NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'retention_months'
  ) THEN
    EXECUTE '
      UPDATE "organizations"
      SET "retention_days" = LEAST(90, GREATEST(30, "retention_months" * 30))
    ';
    EXECUTE 'ALTER TABLE "organizations" DROP COLUMN "retention_months"';
  END IF;
END $$;
--> statement-breakpoint

-- El historial de corridas también habla en días.
ALTER TABLE "retention_runs" ADD COLUMN IF NOT EXISTS "retention_days" integer DEFAULT 30 NOT NULL;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'retention_runs'
      AND column_name = 'retention_months'
  ) THEN
    EXECUTE '
      UPDATE "retention_runs"
      SET "retention_days" = LEAST(90, GREATEST(30, "retention_months" * 30))
    ';
    EXECUTE 'ALTER TABLE "retention_runs" DROP COLUMN "retention_months"';
  END IF;
END $$;
--> statement-breakpoint

-- 2. Autorización del visitante sobre cada pase.
ALTER TABLE "access_passes"
  ADD COLUMN IF NOT EXISTS "consent_accepted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "consent_ip" varchar(64),
  ADD COLUMN IF NOT EXISTS "consent_user_agent" varchar(255),
  ADD COLUMN IF NOT EXISTS "consent_policy_version" varchar(20),
  ADD COLUMN IF NOT EXISTS "consent_mode" varchar(20);
--> statement-breakpoint

-- 3. Preservación por incidente.
CREATE TABLE IF NOT EXISTS "retention_holds" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL,
  "community_id" uuid,
  "from_date" date NOT NULL,
  "to_date" date NOT NULL,
  "reason" text NOT NULL,
  "created_by_person_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "released_at" timestamp with time zone,
  "released_by_person_id" uuid
);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retention_holds_organization_id_organizations_id_fk'
  ) THEN
    ALTER TABLE "retention_holds"
      ADD CONSTRAINT "retention_holds_organization_id_organizations_id_fk"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retention_holds_community_id_communities_id_fk'
  ) THEN
    ALTER TABLE "retention_holds"
      ADD CONSTRAINT "retention_holds_community_id_communities_id_fk"
      FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE set null;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retention_holds_created_by_person_id_people_id_fk'
  ) THEN
    ALTER TABLE "retention_holds"
      ADD CONSTRAINT "retention_holds_created_by_person_id_people_id_fk"
      FOREIGN KEY ("created_by_person_id") REFERENCES "people"("id") ON DELETE set null;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'retention_holds_released_by_person_id_people_id_fk'
  ) THEN
    ALTER TABLE "retention_holds"
      ADD CONSTRAINT "retention_holds_released_by_person_id_people_id_fk"
      FOREIGN KEY ("released_by_person_id") REFERENCES "people"("id") ON DELETE set null;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "retention_holds_organization_range_idx"
  ON "retention_holds" ("organization_id", "from_date", "to_date");
--> statement-breakpoint

-- 4. El disparador de inmutabilidad de la bitácora acepta una sola forma de
--    reescritura: la que anonimiza. La forma se verifica columna por columna, no
--    quién ejecuta: el resumen sólo puede quedar igual o pasar a su versión
--    anónima, los detalles sólo pueden perder identidad y el resto no cambia.
--    El nombre del residente que autorizó se conserva: es la traza de quién dio
--    el permiso, no el dato del visitante.
CREATE OR REPLACE FUNCTION prevent_bitacora_update()
RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'bitacora_entries'
     AND NEW.id = OLD.id
     AND NEW.community_id = OLD.community_id
     AND NEW.access_point_id = OLD.access_point_id
     AND NEW.access_point_name = OLD.access_point_name
     AND NEW.shift_id IS NOT DISTINCT FROM OLD.shift_id
     AND NEW.type = OLD.type
     AND NEW.source = OLD.source
     AND NEW.author_person_id IS NOT DISTINCT FROM OLD.author_person_id
     AND NEW.author_account_id IS NOT DISTINCT FROM OLD.author_account_id
     AND NEW.pass_id IS NOT DISTINCT FROM OLD.pass_id
     AND NEW.pass_scan_id IS NOT DISTINCT FROM OLD.pass_scan_id
     AND NEW.created_at = OLD.created_at
     AND NEW.authorized_by_name IS NOT DISTINCT FROM OLD.authorized_by_name
     AND NEW.summary IN (OLD.summary, 'Acceso anonimizado')
     AND NEW.details = (OLD.details - 'visitor' - 'companions' - 'vehiclePlate')
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'bitacora rows are immutable';
END;
$$ LANGUAGE plpgsql;
