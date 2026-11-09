-- 0003: tenant entry — slugs on organizations/communities + invitations
--
-- ROLLBACK (dev only):
--   DROP TABLE invitations;
--   ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_slug_unique;
--   ALTER TABLE organizations DROP COLUMN slug;
--   ALTER TABLE communities DROP CONSTRAINT IF EXISTS communities_slug_unique;
--   ALTER TABLE communities DROP COLUMN slug;
--   DROP TYPE invitation_status;

CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"email" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"community_id" uuid,
	"unit_id" uuid,
	"role" varchar(20) NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);--> statement-breakpoint

ALTER TABLE "communities" ADD COLUMN "slug" varchar(60);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "slug" varchar(60);--> statement-breakpoint

WITH base AS (
	SELECT
		id,
		COALESCE(
			NULLIF(
				trim(both '-' from left(
					lower(regexp_replace(translate(name, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'), '[^a-zA-Z0-9]+', '-', 'g')),
					50
				)),
				''
			),
			'organization-' || substr(id::text, 1, 8)
		) AS base
	FROM organizations
), numbered AS (
	SELECT id, base, row_number() OVER (PARTITION BY base ORDER BY id) AS rn
	FROM base
)
UPDATE organizations o
SET slug = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || '-' || n.rn END
FROM numbered n
WHERE o.id = n.id;--> statement-breakpoint

WITH base AS (
	SELECT
		id,
		COALESCE(
			NULLIF(
				trim(both '-' from left(
					lower(regexp_replace(translate(name, 'áéíóúÁÉÍÓÚñÑüÜ', 'aeiouAEIOUnNuU'), '[^a-zA-Z0-9]+', '-', 'g')),
					50
				)),
				''
			),
			'community-' || substr(id::text, 1, 8)
		) AS base
	FROM communities
), numbered AS (
	SELECT id, base, row_number() OVER (PARTITION BY base ORDER BY id) AS rn
	FROM base
)
UPDATE communities c
SET slug = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || '-' || n.rn END
FROM numbered n
WHERE c.id = n.id;--> statement-breakpoint

ALTER TABLE "communities" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_community_id_communities_id_fk" FOREIGN KEY ("community_id") REFERENCES "public"."communities"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "invitations_email_status_idx" ON "invitations" USING btree ("email","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invitations_community_status_idx" ON "invitations" USING btree ("community_id","status");--> statement-breakpoint
ALTER TABLE "communities" ADD CONSTRAINT "communities_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_slug_unique" UNIQUE("slug");
