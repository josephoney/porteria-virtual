CREATE TABLE IF NOT EXISTS "user_person_map" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "person_id" uuid NOT NULL,
  "account_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "user_person_map" ("user_id", "person_id", "account_id")
SELECT u."id", p."id", a."id"
FROM "users" u
JOIN "people" p ON p."contact_email" = u."email"
LEFT JOIN "accounts" a ON a."person_id" = p."id"
ON CONFLICT ("user_id") DO NOTHING;
--> statement-breakpoint
UPDATE "refresh_tokens" SET "revoked" = true WHERE "revoked" = false;
