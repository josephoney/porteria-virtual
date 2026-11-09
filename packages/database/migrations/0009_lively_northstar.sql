ALTER TABLE "access_codes" ADD COLUMN "created_by_person_id" uuid;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "operator_person_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "actor_person_id" uuid;--> statement-breakpoint
ALTER TABLE "guard_rounds" ADD COLUMN "guard_person_id" uuid;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "visitors" ADD COLUMN "created_by_person_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_codes" ADD CONSTRAINT "access_codes_created_by_person_id_people_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "calls" ADD CONSTRAINT "calls_operator_person_id_people_id_fk" FOREIGN KEY ("operator_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_actor_person_id_people_id_fk" FOREIGN KEY ("actor_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_rounds" ADD CONSTRAINT "guard_rounds_guard_person_id_people_id_fk" FOREIGN KEY ("guard_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "visitors" ADD CONSTRAINT "visitors_created_by_person_id_people_id_fk" FOREIGN KEY ("created_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
UPDATE "visitors" v SET "created_by_person_id" = p."id"
FROM "users" u JOIN "people" p ON p."contact_email" = u."email"
WHERE v."created_by" = u."id" AND v."created_by_person_id" IS NULL;
--> statement-breakpoint
UPDATE "calls" c SET "operator_person_id" = p."id"
FROM "users" u JOIN "people" p ON p."contact_email" = u."email"
WHERE c."operator_id" = u."id" AND c."operator_person_id" IS NULL;
--> statement-breakpoint
UPDATE "events" e SET "actor_person_id" = p."id"
FROM "users" u JOIN "people" p ON p."contact_email" = u."email"
WHERE e."actor_id" = u."id" AND e."actor_person_id" IS NULL;
--> statement-breakpoint
UPDATE "access_codes" a SET "created_by_person_id" = p."id"
FROM "users" u JOIN "people" p ON p."contact_email" = u."email"
WHERE a."created_by" = u."id" AND a."created_by_person_id" IS NULL;
--> statement-breakpoint
UPDATE "guard_rounds" g SET "guard_person_id" = p."id"
FROM "users" u JOIN "people" p ON p."contact_email" = u."email"
WHERE g."guard_id" = u."id" AND g."guard_person_id" IS NULL;
--> statement-breakpoint
UPDATE "refresh_tokens" r SET "account_id" = a."id"
FROM "accounts" a
WHERE r."user_id" IN (SELECT u."id" FROM "users" u WHERE u."email" = a."email")
  AND r."account_id" IS NULL;