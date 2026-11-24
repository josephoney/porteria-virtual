-- La retención sólo anonimiza la cédula: el nombre, los acompañantes, la placa
-- y el resumen se conservan como registro de quién entró. El disparador de
-- inmutabilidad sigue verificando la FORMA del cambio, no quién lo ejecuta:
-- cualquier otra escritura sobre la bitácora sigue siendo imposible.

CREATE OR REPLACE FUNCTION prevent_bitacora_update()
RETURNS trigger AS $$
DECLARE
  redacted jsonb;
BEGIN
  IF TG_TABLE_NAME = 'bitacora_entries' THEN
    redacted := OLD.details;

    IF jsonb_typeof(redacted -> 'visitor') = 'object'
       AND (redacted -> 'visitor') ? 'document' THEN
      redacted := jsonb_set(
        redacted,
        '{visitor,document}',
        to_jsonb('ANONIMIZADO'::text),
        false
      );
    END IF;

    IF redacted ? 'visitorDocument' THEN
      redacted := jsonb_set(
        redacted,
        '{visitorDocument}',
        to_jsonb('ANONIMIZADO'::text),
        false
      );
    END IF;

    IF NEW.id = OLD.id
       AND NEW.community_id = OLD.community_id
       AND NEW.access_point_id = OLD.access_point_id
       AND NEW.access_point_name = OLD.access_point_name
       AND NEW.shift_id IS NOT DISTINCT FROM OLD.shift_id
       AND NEW.type = OLD.type
       AND NEW.source = OLD.source
       AND NEW.author_person_id IS NOT DISTINCT FROM OLD.author_person_id
       AND NEW.author_account_id IS NOT DISTINCT FROM OLD.author_account_id
       AND NEW.pass_id IS NOT DISTINCT FROM OLD.pass_id
       AND NEW.pass_scan_id IS NOT DISTINCT FROM OLD.pass_scan_id
       AND NEW.created_at = OLD.created_at
       AND NEW.authorized_by_name IS NOT DISTINCT FROM OLD.authorized_by_name
       AND NEW.summary = OLD.summary
       AND NEW.details = redacted
    THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'bitacora rows are immutable';
END;
$$ LANGUAGE plpgsql;
