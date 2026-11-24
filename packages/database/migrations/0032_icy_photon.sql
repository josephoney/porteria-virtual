-- Regla de la comunidad: si usa pases con QR dinámico o sólo documento.
--
-- Se puede volver a ejecutar sin efectos laterales: la columna sólo se crea si
-- falta y las comunidades existentes quedan con la regla activa, que es lo que
-- hoy hace el interruptor global de entorno.

ALTER TABLE "communities" ADD COLUMN IF NOT EXISTS "dynamic_qr_enabled" boolean DEFAULT true NOT NULL;
