-- Una sesión sin cuenta ya no puede autenticar a nadie: se descartan las
-- que además están revocadas o vencidas antes de exigir la columna.
DELETE FROM "refresh_tokens" WHERE "account_id" IS NULL AND ("revoked" = true OR "expires_at" < now());
--> statement-breakpoint
-- Si queda algo sin cuenta, la migración se aborta en vez de romper sesiones vivas.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "refresh_tokens" WHERE "account_id" IS NULL) THEN
  RAISE EXCEPTION 'refresh_tokens sin account_id: hay sesiones activas sin cuenta, revisar antes de aplicar';
 END IF;
 IF EXISTS (
  SELECT 1 FROM "users" u
  WHERE NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."email" = u."email")
 ) THEN
  RAISE EXCEPTION 'usuarios sin cuenta: crear su fila en accounts antes de quitar user_id';
 END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP CONSTRAINT "refresh_tokens_account_id_accounts_id_fk";
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "user_id";