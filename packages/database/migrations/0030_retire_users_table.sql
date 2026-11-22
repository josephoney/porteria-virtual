-- Retiro definitivo de la tabla legada `users`.
--
-- Antes de eliminarla se conserva el nombre historico de los eventos: el actor
-- se resuelve por la cuenta asociada al email del usuario referenciado.
UPDATE events e
SET actor_person_id = a.person_id
FROM users u
JOIN accounts a ON a.email = u.email
WHERE e.actor_id = u.id
  AND e.actor_person_id IS NULL;
--> statement-breakpoint

-- Las dos columnas legadas opcionales no tienen filas en la practica, pero se
-- completan para no perder el dato si existiera.
UPDATE access_codes ac
SET created_by_person_id = a.person_id
FROM users u
JOIN accounts a ON a.email = u.email
WHERE ac.created_by = u.id
  AND ac.created_by_person_id IS NULL;
--> statement-breakpoint
UPDATE visitors v
SET created_by_person_id = a.person_id
FROM users u
JOIN accounts a ON a.email = u.email
WHERE v.created_by = u.id
  AND v.created_by_person_id IS NULL;
--> statement-breakpoint

-- Guarda: si algun usuario no tiene cuenta por email, eliminar la tabla
-- perderia su nombre sin forma de recuperarlo. Abortar en ese caso.
DO $$
DECLARE
  usuarios_sin_cuenta integer;
BEGIN
  SELECT count(*) INTO usuarios_sin_cuenta
  FROM users u
  LEFT JOIN accounts a ON a.email = u.email
  WHERE a.id IS NULL;

  IF usuarios_sin_cuenta > 0 THEN
    RAISE EXCEPTION 'usuarios sin cuenta: % filas perderian su nombre', usuarios_sin_cuenta;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "access_codes" DROP CONSTRAINT "access_codes_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "memberships" DROP CONSTRAINT "memberships_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "visitors" DROP CONSTRAINT "visitors_created_by_users_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "memberships_user_idx";
--> statement-breakpoint
ALTER TABLE "access_codes" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "memberships" DROP COLUMN IF EXISTS "user_id";
--> statement-breakpoint
ALTER TABLE "visitors" DROP COLUMN IF EXISTS "created_by";
--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP TABLE "users";
