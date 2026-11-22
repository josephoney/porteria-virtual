-- Las llamadas dejan de apuntar a `users` y pasan a apuntar a la persona.
-- Backfill: el operador se resuelve por la cuenta asociada a su email.
UPDATE calls c
SET operator_person_id = a.person_id
FROM users u
JOIN accounts a ON a.email = u.email
WHERE c.operator_id = u.id
  AND c.operator_person_id IS NULL;
--> statement-breakpoint

-- Guarda: abortar si quedarían llamadas con operador pero sin persona.
DO $$
DECLARE
  pendientes integer;
BEGIN
  SELECT count(*) INTO pendientes
  FROM calls
  WHERE operator_id IS NOT NULL AND operator_person_id IS NULL;

  IF pendientes > 0 THEN
    RAISE EXCEPTION 'llamadas sin persona: % filas tienen operator_id y no se pudo resolver operator_person_id', pendientes;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "calls" DROP CONSTRAINT "calls_operator_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN IF EXISTS "operator_id";
