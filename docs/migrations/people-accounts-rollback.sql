-- Emergency rollback for the people/accounts separation.
-- Run inside a transaction and take a database backup first.
-- This restores the legacy authentication path (users + memberships.user_id).
-- It intentionally preserves people/accounts rows to avoid destructive data loss.

BEGIN;

-- Force every session to authenticate again with a token compatible with the
-- rolled-back backend.
UPDATE refresh_tokens SET revoked = true WHERE revoked = false;

-- Old code resolves memberships through users; person references are optional.
UPDATE memberships SET person_id = NULL WHERE person_id IS NOT NULL;

-- Stop creating new accounts while legacy code is active.
UPDATE accounts SET active = false WHERE active = true;

-- The compatibility map is only used by the new code path.
DROP TABLE IF EXISTS user_person_map;

COMMIT;
