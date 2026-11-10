DO $$
DECLARE
  community_rec RECORD;
  primary_id uuid;
  secondary_id uuid;
  merged_units integer;
  updated_passes integer;
  updated_scans integer;
BEGIN
  FOR community_rec IN
    SELECT community_id
    FROM location_structures
    GROUP BY community_id
    HAVING count(*) > 1
  LOOP
    SELECT s.id
    INTO primary_id
    FROM location_structures s
    WHERE s.community_id = community_rec.community_id
    ORDER BY
      (s.name = 'Estructura principal') DESC,
      (SELECT count(*) FROM location_units u WHERE u.structure_id = s.id) DESC,
      s.created_at ASC,
      s.id ASC
    LIMIT 1;

    FOR secondary_id IN
      SELECT s.id
      FROM location_structures s
      WHERE s.community_id = community_rec.community_id
        AND s.id <> primary_id
    LOOP
      IF EXISTS (
        SELECT 1
        FROM location_units secondary_unit
        JOIN location_units primary_unit
          ON primary_unit.structure_id = primary_id
         AND primary_unit.parent_id IS NULL
         AND secondary_unit.parent_id IS NULL
         AND primary_unit.code IS NOT NULL
         AND secondary_unit.code IS NOT NULL
         AND primary_unit.code = secondary_unit.code
        WHERE secondary_unit.structure_id = secondary_id
      ) THEN
        RAISE EXCEPTION
          'Cannot merge location structures for community %: duplicate root code between structure % and primary structure %',
          community_rec.community_id,
          secondary_id,
          primary_id;
      END IF;

      UPDATE location_units
      SET structure_id = primary_id
      WHERE structure_id = secondary_id;
      GET DIAGNOSTICS merged_units = ROW_COUNT;

      UPDATE access_passes
      SET structure_id = primary_id
      WHERE structure_id = secondary_id;
      GET DIAGNOSTICS updated_passes = ROW_COUNT;

      UPDATE pass_scans
      SET structure_id = primary_id
      WHERE structure_id = secondary_id;
      GET DIAGNOSTICS updated_scans = ROW_COUNT;

      DELETE FROM location_structures WHERE id = secondary_id;

      RAISE NOTICE
        'Merged structure % into % for community %: % units, % passes, % scans',
        secondary_id,
        primary_id,
        community_rec.community_id,
        merged_units,
        updated_passes,
        updated_scans;
    END LOOP;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "location_structures_community_uidx" ON "location_structures" USING btree ("community_id");
