-- Post-migration verification for people/accounts separation.
-- Safe to run repeatedly; read-only.

SELECT 'users_without_person' AS check, COUNT(*)::int AS failures
FROM users u
LEFT JOIN people p ON p.contact_email = u.email
WHERE p.id IS NULL;

SELECT 'accounts_without_person' AS check, COUNT(*)::int AS failures
FROM accounts a
LEFT JOIN people p ON p.id = a.person_id
WHERE p.id IS NULL;

SELECT 'memberships_without_person' AS check, COUNT(*)::int AS failures
FROM memberships m
WHERE m.person_id IS NULL;

SELECT 'refresh_tokens_without_account' AS check, COUNT(*)::int AS failures
FROM refresh_tokens
WHERE account_id IS NULL;

SELECT 'user_person_map_rows' AS check, COUNT(*)::int AS value
FROM user_person_map;

SELECT 'duplicate_person_emails' AS check, COUNT(*)::int AS failures
FROM (
  SELECT contact_email
  FROM people
  WHERE contact_email IS NOT NULL
  GROUP BY contact_email
  HAVING COUNT(*) > 1
) duplicates;
