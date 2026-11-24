-- La bitácora es un registro inmutable: nadie puede reescribir lo que pasó en
-- la portería. La retención de datos es la única excepción legítima, y sólo
-- para quitar la identidad del visitante.
--
-- El disparador ahora verifica la forma de la actualización en lugar de
-- confiar en quien la ejecuta: si alguna columna que cuenta la historia
-- cambia, o si el detalle gana campos en vez de perderlos, la fila se rechaza
-- igual que antes. Así la retención no necesita desactivar ninguna protección.
CREATE OR REPLACE FUNCTION prevent_bitacora_update() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'bitacora_entries'
     AND NEW.id = OLD.id
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
     AND NEW.summary = OLD.summary
     AND NEW.created_at = OLD.created_at
     AND NEW.authorized_by_name IS NULL
     AND NEW.details = (
       OLD.details - 'visitor' - 'companions' - 'vehiclePlate' - 'authorizedByName'
     )
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'bitacora rows are immutable';
END;
$$ LANGUAGE plpgsql;
