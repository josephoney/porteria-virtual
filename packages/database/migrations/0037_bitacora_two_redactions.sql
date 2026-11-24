-- La retención tiene que poder aplicar dos formas sobre la bitácora:
--
--   1. Quitar la identidad completa del visitante (nombre, documento,
--      acompañantes y placa) y reemplazar el resumen por su marcador.
--   2. Quitar sólo el documento, cuando la corrida anterior ya se aplicó.
--
-- El disparador de inmutabilidad sigue verificando la FORMA del cambio, no quién
-- lo ejecuta: acepta exactamente esas dos formas y cualquier otra escritura
-- sobre la bitácora sigue siendo imposible.

CREATE OR REPLACE FUNCTION prevent_bitacora_update()
RETURNS trigger AS $$
DECLARE
  full_redaction jsonb;
  document_redaction jsonb;
  anonymized_summary text;
BEGIN
  IF TG_TABLE_NAME = 'bitacora_entries' THEN
    -- Forma 1: desaparece todo lo que describe al visitante.
    full_redaction := OLD.details - 'visitor' - 'companions' - 'vehiclePlate';

    -- Forma 2: el documento se reemplaza y el resto queda igual.
    document_redaction := OLD.details;

    IF jsonb_typeof(document_redaction -> 'visitor') = 'object'
       AND (document_redaction -> 'visitor') ? 'document' THEN
      document_redaction := jsonb_set(
        document_redaction,
        '{visitor,document}',
        to_jsonb('ANONIMIZADO'::text),
        false
      );
    END IF;

    IF document_redaction ? 'visitorDocument' THEN
      document_redaction := jsonb_set(
        document_redaction,
        '{visitorDocument}',
        to_jsonb('ANONIMIZADO'::text),
        false
      );
    END IF;

    -- El resumen sólo puede quedar igual o pasar al marcador genérico.
    anonymized_summary := OLD.summary;

    IF (OLD.details -> 'visitor' ->> 'firstName') IS NOT NULL
       AND OLD.summary LIKE '%' || (OLD.details -> 'visitor' ->> 'firstName') || '%' THEN
      anonymized_summary := 'Acceso anonimizado';
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
       -- El autorizador no es el visitante y se conserva siempre.
       AND NEW.authorized_by_name IS NOT DISTINCT FROM OLD.authorized_by_name
       AND NEW.summary IN (OLD.summary, anonymized_summary)
       AND (
         NEW.details = full_redaction
         OR NEW.details = document_redaction
       )
    THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION 'bitacora rows are immutable';
END;
$$ LANGUAGE plpgsql;
