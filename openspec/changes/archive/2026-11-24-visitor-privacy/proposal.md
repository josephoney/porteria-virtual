## Why

La retención quedó en 12 meses y sin consentimiento. La Ley 1581 de 2012 exige
una finalidad informada, una autorización demostrable, minimización y una
temporalidad razonable; hoy el sistema guarda la identidad del visitante un año
sin aviso ni prueba de aceptación, y cualquiera con acceso a la bitácora puede
abrir el detalle de un ingreso y leer el documento completo, sin importar el rol
ni la fecha.

Al mismo tiempo, anonimizar demasiado pronto deja a la comunidad sin la
información que necesita cuando ocurre un incidente. La respuesta no es guardar
todo «por si acaso», que es justamente lo sancionado: es conservar poco por
defecto y **preservar lo puntual** cuando hay una investigación, con autor,
motivo y vencimiento.

## What Changes

- **Ventana en días**: la retención pasa de meses a días, configurable en 30, 60
  o 90 por organización, con 30 por defecto.
- **Consentimiento registrado**: el visitante acepta el tratamiento al abrir el
  pase, con fecha, IP y versión de la política. Si nunca abre el enlace, el
  ingreso registra la aceptación en portería (`at_gate`), amparada en el aviso
  visible y la información verbal del guardia.
- **Preservación por incidente**: un rango de fechas puede congelarse con motivo,
  autor y vencimiento; el barrido no toca esos registros.
- **Visibilidad por rol**: el documento completo sólo lo ven los administradores
  de la comunidad y de la organización. El operador y el guardia ven el documento
  enmascarado en el historial; el guardia lo ve completo únicamente en el momento
  del escaneo, que es su función. El residente ve los datos de sus propios
  invitados.
- **La anonimización deja de borrar al residente que autorizó** y pasa a borrar
  el nombre del visitante también del resumen del registro, que hoy lo repite en
  texto libre.
- **Nada de identidad en las exportaciones**: los archivos siguen saliendo con
  agregados.
- **Textos legales**: aviso de privacidad, aviso de portería y cláusula de
  transmisión para la empresa de vigilancia.

## Capabilities

### New Capabilities

- `visitor-privacy`: consentimiento, visibilidad por rol, ventana de retención en
  días y preservación por incidente sobre los datos del visitante.

### Modified Capabilities

None.

## Impact

- `packages/database`: `organizations.retention_days` en lugar de
  `retention_months`; columnas de consentimiento en `access_passes`; tabla
  `retention_holds`; el disparador de inmutabilidad de la bitácora acepta una
  única forma de reescritura y conserva al autorizador.
- `server/api`: barrido por días con exclusión de rangos preservados; registro
  del consentimiento en el pase público y en el escaneo; enmascarado por rol en
  la bitácora; endpoints para crear y liberar preservaciones; ajuste de los
  textos que escriben el nombre del visitante en el resumen.
- `apps/pass-web` y `apps/zima-qr-access`: aviso y casilla en el pase público.
- `apps/dashboard`: ventana 30/60/90 en el perfil, estado del consentimiento en
  el detalle del ingreso y gestión de preservaciones.
- `docs`: política de tratamiento, aviso de portería y cláusula de transmisión.
- Sin cambio en los reportes: sus totales no dependen de la identidad.
