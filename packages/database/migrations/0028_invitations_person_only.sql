ALTER TABLE "invitations" ADD COLUMN "invited_by_person_id" uuid;--> statement-breakpoint
UPDATE invitations i
SET invited_by_person_id = a.person_id
FROM users u
JOIN accounts a ON a.email = u.email
WHERE i.invited_by = u.id AND i.invited_by_person_id IS NULL;--> statement-breakpoint
DO $$
DECLARE
  missing integer;
BEGIN
  SELECT count(*) INTO missing
  FROM invitations i
  WHERE i.invited_by IS NOT NULL AND i.invited_by_person_id IS NULL;

  IF missing > 0 THEN
    RAISE EXCEPTION 'invitaciones sin persona: % sin mapear a people', missing;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_invited_by_users_id_fk";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_person_id_people_id_fk" FOREIGN KEY ("invited_by_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "invitations" DROP COLUMN IF EXISTS "invited_by";
