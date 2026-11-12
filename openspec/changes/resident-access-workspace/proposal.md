## Why

Hoy un residente inicia sesión en el dashboard y lo único que encuentra es una pantalla que lo expulsa: `HomePage` lo redirige a `/app-required`, que dice "Usá Zima QR Access". El residente tiene cuenta, comunidad y unidad asignada, y la API ya le permite crear pases (`POST /api/passes`), listarlos y revocar los suyos. Pero desde la web no puede hacer nada.

Al mismo tiempo, el pase solo apunta a una unidad de vivienda (`location_unit_id`). No existe forma de autorizar a alguien a un lugar común —club social, piscina, cancha de golf, salón comunal—, que es exactamente el caso de uso real: "autorizo a mi invitado a la piscina", "autorizo al grupo de la fiesta al salón comunal".

Y cuando la autorización es para muchas personas (una fiesta, un cumpleaños), no hay más camino que crear un pase por persona, uno por uno, con todo el formulario cada vez.

Tres consecuencias concretas:

1. El residente no puede autogestionarse desde la web.
2. Todo invitado se modela como visita a la vivienda, aunque el destino sea otro.
3. Las autorizaciones grupales no son viables en la práctica.

## What Changes

- **El residente entra al dashboard**: nueva superficie `/resident` con su propio layout y navegación. `/app-required` deja de aplicarse a `owner`, `tenant` y `resident`.
- **Inicio del residente**: accesos rápidos ("Autorizar visita", "Autorización masiva"), autorizaciones vigentes y las próximas a vencer.
- **Destino de la autorización**: al crear un pase el residente elige entre su vivienda y los lugares comunes activos de la comunidad.
- **Lugares comunes dentro del árbol**: el admin los crea en `Unidades`, como una sección de nivel 1 con tipo `Zona común` y sus lugares como hijos (Piscina, Club social, Cancha). No hay catálogo paralelo ni menú nuevo.
- **Historial de autorizaciones**: tabla con visitante, destino, vigencia, estado y acciones (ver QR, compartir enlace, regenerar, revocar). Filtros por estado, destino, fecha y búsqueda por nombre o documento.
- **Carga masiva**: pegar o subir un CSV con nombre, apellido, documento y placa opcional; un destino y una ventana de vigencia para todo el lote; vista previa con errores por fila y un resumen al final.
- **Modelo de datos**: `location_units.section_type` acepta `common_area` y `access_passes` gana `batch_id` y `batch_label`. El destino sigue siendo `location_unit_id`, sin columnas nulables ni tabla nueva.

## Capabilities

### New Capabilities

- `resident-workspace`: ingreso del residente al dashboard, layout, navegación, inicio y alcance de sus datos.
- `pass-destinations`: lugares comunes como ramas del árbol, autoría desde `Unidades`, selección por el residente y reglas de destino del pase.
- `resident-authorization-history`: historial de autorizaciones con filtros, detalle, QR, enlace público y revocación.
- `bulk-authorizations`: carga masiva por CSV, validación por fila, lote y reporte de resultado.

### Modified Capabilities

Ninguna. `dynamic-pass-creation`, `pass-lifecycle` y `rotating-qr` siguen viviendo en el change en curso `add-dynamic-qr-access`; este change los extiende sin redefinirlos. Las reglas de destino se declaran en `pass-destinations` como requisito nuevo y no reescriben lo existente.

## Impact

- `packages/database/src/schema/location-units.ts`: valor `common_area` en `sectionTypeEnum`.
- `packages/database/src/schema/access-passes.ts`: columnas `batch_id` y `batch_label`; migración nueva.
- `packages/shared`: tipos `DestinationKind`, `DestinationSummary`, `PassBatchRequest` y `PassBatchResult`.
- `server/api/src/schemas/index.ts`: `createPassSchema` acepta un nodo de cualquier nivel según su tipo, y el esquema de lote.
- `server/api/src/services/pass.service.ts`: resolución y validación del destino, clasificación por ancestro y creación por lote.
- `server/api/src/routes/pass.routes.ts`: filtros de historial y `POST /api/passes/batch`.
- `server/api/src/routes/location-nodes.routes.ts`: aceptar `common_area` en el alta y edición de nivel 1.
- `apps/dashboard/src/App.tsx`: rutas `/resident`, `/resident/authorizations`, `/resident/authorizations/new`, `/resident/authorizations/bulk`; `HomePage` deja de expulsar al residente.
- `apps/dashboard/src/components/resident/*` (nuevo): layout, inicio, formulario, historial, carga masiva.
- `apps/dashboard/src/components/admin/UnitsWorkspace.tsx`: select de tipo de sección con `Zona común`.
- `tests/resident-access.spec.ts` (nuevo) y ajustes en los specs que hoy esperan `/app-required`.

## Fuera de alcance

- Notificaciones al visitante por WhatsApp, SMS o email. El enlace se comparte a mano o con el `share` del navegador.
- Delegación de residentes a terceros (`authorized_by_delegation_id`), que depende de `add-delegated-subusers`.
- Reserva de amenidades con cupo, horario o cobro. El destino es solo el lugar al que se autoriza el ingreso.
- App nativa o PWA offline del residente. Este change es la web del dashboard.
- Recurrencia avanzada (`entry_exit_recurring`), que sigue reservada a Phase 2.
- Reconocimiento facial, biometría o lectura de documentos.
