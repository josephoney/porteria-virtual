# Location hierarchy migration and rollback

## Backup

Before migrating a production database:

```powershell
pg_dump --format=custom --file=backups/porteria_pre_location_hierarchy.dump $env:DATABASE_URL
```

Verify the dump can be listed:

```powershell
pg_restore --list backups/porteria_pre_location_hierarchy.dump
```

## Forward migration

Apply the database migrations before deploying the API and dashboard:

```powershell
pnpm --filter @porteria/database db:migrate
```

Migrations `0008` and `0009` create the hierarchy, people, accounts and asset
tables, map legacy `memberships.unit_id` and `invitations.unit_id` to
`location_unit_id`, and copy users into people/accounts while keeping the legacy
`users` table for login compatibility.

## Rollback

Rollback is only safe while the legacy `units`, `unit_id` and `users` columns are
still present. Do not drop them before validating the new hierarchy in
production.

```sql
BEGIN;

UPDATE memberships
SET unit_id = u.id
FROM units u
JOIN location_units lu ON lu.id = memberships.location_unit_id
WHERE memberships.unit_id IS NULL
  AND lu.community_id = u.community_id
  AND lu.code = u.code;

UPDATE invitations
SET unit_id = u.id
FROM units u
JOIN location_units lu ON lu.id = invitations.location_unit_id
WHERE invitations.unit_id IS NULL
  AND lu.community_id = u.community_id
  AND lu.code = u.code;

COMMIT;
```

Schema rollback:

```sql
BEGIN;

ALTER TABLE memberships DROP COLUMN IF EXISTS location_unit_id;
ALTER TABLE memberships DROP COLUMN IF EXISTS person_id;
ALTER TABLE invitations DROP COLUMN IF EXISTS location_unit_id;
ALTER TABLE organizations
  DROP COLUMN IF EXISTS legal_representative_person_id,
  DROP COLUMN IF EXISTS welcome_message,
  DROP COLUMN IF EXISTS address,
  DROP COLUMN IF EXISTS phone,
  DROP COLUMN IF EXISTS nit;
ALTER TABLE communities
  DROP COLUMN IF EXISTS type_label,
  DROP COLUMN IF EXISTS type,
  DROP COLUMN IF EXISTS welcome_message,
  DROP COLUMN IF EXISTS logo_asset_id;

DROP TABLE IF EXISTS assets;
DROP TABLE IF EXISTS accounts;
DROP TABLE IF EXISTS people;

COMMIT;
```

## Verification after rollback

```sql
SELECT count(*) FROM memberships WHERE unit_id IS NULL AND location_unit_id IS NOT NULL;
SELECT count(*) FROM invitations WHERE unit_id IS NULL AND location_unit_id IS NOT NULL;
SELECT count(*) FROM location_residents;
```

The first two queries must return zero when the legacy mapping is complete.
Resident rows are not modified by the hierarchy migration and must keep their
original count.
