-- Activación de cuentas creadas por el administrador: la cuenta nace sin
-- contraseña usable y el enlace de activación marca el momento en que la
-- persona eligió la propia.
--
-- Las cuentas existentes ya podían ingresar, así que se consideran activadas
-- desde su creación. El bloque es idempotente: si la columna ya existe no se
-- vuelve a correr el backfill (de lo contrario marcaría como activas las
-- cuentas nuevas que todavía esperan su enlace).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'accounts'
      AND column_name = 'activated_at'
  ) THEN
    ALTER TABLE "accounts" ADD COLUMN "activated_at" timestamp with time zone;
    UPDATE "accounts" SET "activated_at" = "created_at";
  END IF;
END $$;

-- Rollback (ejecutar a mano si hay que volver atrás):
--   ALTER TABLE "accounts" DROP COLUMN IF EXISTS "activated_at";
-- Las cuentas vuelven a no distinguir si ya eligieron su contraseña; el enlace
-- de activación deja de poder reenviarse con la guarda de "ya activa".
