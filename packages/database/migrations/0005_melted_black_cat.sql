-- 0005: kiosk device authentication and unique rpi identity
--
-- ROLLBACK (dev only):
--   DROP INDEX IF EXISTS kiosks_rpi_id_unique;
--   ALTER TABLE kiosks DROP COLUMN device_token_rotated_at;
--   ALTER TABLE kiosks DROP COLUMN device_token_hash;

ALTER TABLE "kiosks" ADD COLUMN "device_token_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "kiosks" ADD COLUMN "device_token_rotated_at" timestamp with time zone;--> statement-breakpoint

-- Keep the newest kiosk for each rpi_id and rename older/legacy duplicates
-- so the unique index can be applied safely.
WITH ranked AS (
  SELECT id, rpi_id, row_number() OVER (PARTITION BY rpi_id ORDER BY created_at DESC, id) AS rn
  FROM kiosks
  WHERE rpi_id IS NOT NULL
)
UPDATE kiosks k
SET rpi_id = k.rpi_id || '-legacy-' || substr(k.id::text, 1, 8)
FROM ranked r
WHERE k.id = r.id AND r.rn > 1;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "kiosks_rpi_id_unique" ON "kiosks" USING btree ("rpi_id");
