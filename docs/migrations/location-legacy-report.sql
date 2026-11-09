-- Unresolved legacy location references after migrations 0008/0009.
-- Every row must be reviewed before removing units.unit_id or invitations.unit_id.

SELECT
  'membership' AS source,
  m.id AS row_id,
  m.organization_id,
  m.community_id,
  m.unit_id AS legacy_unit_id,
  m.location_unit_id
FROM memberships m
WHERE m.unit_id IS NOT NULL
  AND m.location_unit_id IS NULL

UNION ALL

SELECT
  'invitation' AS source,
  i.id AS row_id,
  i.organization_id,
  i.community_id,
  i.unit_id AS legacy_unit_id,
  i.location_unit_id
FROM invitations i
WHERE i.unit_id IS NOT NULL
  AND i.location_unit_id IS NULL

ORDER BY source, row_id;

-- Duplicate code candidates: a legacy unit code matching more than one location
-- unit in the same community cannot be auto-mapped safely.
SELECT
  u.community_id,
  u.code,
  count(*) AS matches
FROM units u
JOIN location_units lu
  ON lu.community_id = u.community_id
 AND lu.code = u.code
GROUP BY u.community_id, u.code
HAVING count(*) > 1;
