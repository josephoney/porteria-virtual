-- Enlaces de recuperación de contraseña: token hasheado, de un solo uso y con
-- vencimiento. La tabla se puede volver a crear sin efectos laterales.

CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "account_id" uuid NOT NULL,
  "token_hash" varchar(255) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "requested_ip" varchar(64),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'password_reset_tokens_account_id_accounts_id_fk'
  ) THEN
    ALTER TABLE "password_reset_tokens"
      ADD CONSTRAINT "password_reset_tokens_account_id_accounts_id_fk"
      FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_unique"
  ON "password_reset_tokens" ("token_hash");
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "password_reset_tokens_account_idx"
  ON "password_reset_tokens" ("account_id", "created_at");

-- Rollback (ejecutar a mano si hay que volver atr�s):
--   DROP TABLE IF EXISTS "password_reset_tokens";
-- Es seguro: no toca accounts ni sesiones. Los enlaces vigentes se pierden y
-- quien los tenga debe pedir uno nuevo.
