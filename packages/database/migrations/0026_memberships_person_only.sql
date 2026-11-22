-- Las membresías pasan a colgar de la persona y no del usuario.
--
-- Hasta ahora `user_id` era obligatorio y `person_id` opcional, lo que dejaba
-- dos fuentes de verdad: una membresía podía existir sin persona detrás y la
-- autorización dependía de la tabla `users`, que vamos a retirar.
--
-- Orden: backfill desde la cuenta, verificación explícita, y recién ahí los
-- cambios de nulabilidad e índices.

UPDATE memberships m
SET person_id = a.person_id
FROM users u
JOIN accounts a ON a.email = u.email
WHERE m.user_id = u.id
  AND m.person_id IS NULL;--> statement-breakpoint

DO $$
DECLARE
  faltantes integer;
  duplicadas integer;
BEGIN
  SELECT count(*) INTO faltantes FROM memberships WHERE person_id IS NULL;
  IF faltantes > 0 THEN
    RAISE EXCEPTION 'memberships sin persona: % filas sin person_id; no se puede hacer NOT NULL', faltantes;
  END IF;

  SELECT count(*) INTO duplicadas
  FROM (
    SELECT person_id, organization_id, community_id, unit_id, role
    FROM memberships
    GROUP BY 1, 2, 3, 4, 5
    HAVING count(*) > 1
  ) d;
  IF duplicadas > 0 THEN
    RAISE EXCEPTION 'memberships duplicadas por (persona, organizacion, comunidad, unidad, rol): % combinaciones; resolverlas antes del indice unico', duplicadas;
  END IF;
END $$;--> statement-breakpoint

DROP INDEX IF EXISTS "memberships_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "memberships_unique_idx";--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "memberships" ALTER COLUMN "person_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memberships_unique_idx" ON "memberships" USING btree ("person_id","organization_id","community_id","unit_id","role");
