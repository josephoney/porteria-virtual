-- Retención de datos por organización.
--
-- Cada organización define cuántos meses conserva la identidad del visitante
-- en el registro de acceso. El registro no se borra: se anonimiza, para que
-- los reportes del período sigan contando igual. `retention_runs` guarda el
-- resultado de cada corrida, también las simulaciones.
--
-- La migración se puede volver a ejecutar sin efectos laterales: la tabla, la
-- columna, la referencia y el índice sólo se crean si faltan.

CREATE TABLE IF NOT EXISTS "retention_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retention_months" integer NOT NULL,
	"dry_run" boolean NOT NULL,
	"anonymized_passes" integer DEFAULT 0 NOT NULL,
	"anonymized_scans" integer DEFAULT 0 NOT NULL,
	"anonymized_entries" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "retention_months" integer DEFAULT 12 NOT NULL;
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "retention_runs" ADD CONSTRAINT "retention_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "retention_runs_organization_ran_at_idx" ON "retention_runs" USING btree ("organization_id","ran_at");
