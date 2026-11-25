-- Cambio obligatorio de contraseña: el administrador entrega una temporal y la
-- cuenta no puede seguir sin reemplazarla.

ALTER TABLE "accounts"
  ADD COLUMN IF NOT EXISTS "must_change_password" boolean DEFAULT false NOT NULL;

-- Rollback (ejecutar a mano si hay que volver atrás):
--   ALTER TABLE "accounts" DROP COLUMN IF EXISTS "must_change_password";
-- Las cuentas vuelven a poder usar su contraseña actual sin pasar por el cambio.
