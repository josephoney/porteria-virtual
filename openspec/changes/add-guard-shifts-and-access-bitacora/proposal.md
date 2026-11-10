## Why

El guardia escanea con la app, pero hoy el dashboard de guardia es un placeholder y el
escaneo no registra el lugar físico. Una comunidad puede tener varias porterías o
portones y necesita saber dónde se validó cada acceso. Además, el turno del guardia no
existe como entidad: no hay inicio/fin, ni acceso asignado, ni una bitácora inmutable por
lugar.

Este change agrega turnos personales de guardia, puntos de acceso nombrados y una
bitácora append-only por lugar físico. El operador queda fuera: sigue con su función de
monitoreo en las centrales.

## What Changes

- Nombrar y administrar access points por comunidad: CRUD, `active`, `gpio_pin`
  nullable y dirección `entry`/`exit`/`both`.
- Asignar `memberships.default_access_point_id` al guardia para que el turno arranque en
  su portería.
- Crear `guard_shifts` (turno personal) y `guard_shift_segments` (tramos por acceso).
- Permitir varios guardias con turno abierto en el mismo acceso.
- Crear `bitacora_entries` inmutable por `community_id` + `access_point_id` y
  `bitacora_comments`.
- Registrar automáticamente desde la app: ingreso, egreso, rechazo, escaneo denegado,
  inicio/fin de turno y cambio de acceso.
- Registrar manualmente desde el dashboard: novedades, paquetes, incidentes u
  observaciones.
- Integrar el escaneo con el turno abierto: guardar `shift_id` y `access_point_id`;
  confirmar o rechazar exige estar en turno en ese acceso.
- Dashboard de guardia real: turno, datos personales, bitácora del acceso, entrada
  manual y comentarios.
- Admin de accesos y Bitácora de accesos por comunidad y por acceso. La página actual de
  eventos pasa a llamarse Auditoría.
- Modo guardia de Zima: iniciar/cambiar/cerrar turno, escanear, confirmar/rechazar e
  historial.
- **Fuera de alcance:** operadores (sin turno ni bitácora), grants por persona/acceso
  (Phase 2), push, recurrentes, subusuarios y edición/borrado de bitácora.

## Capabilities

### New Capabilities

- `guard-shifts`: turnos personales, segmentos por acceso, acceso default y múltiples
  guardias por acceso.
- `access-bitacora`: log inmutable por lugar físico, eventos automáticos y manuales,
  comentarios y permisos.
- `access-point-management`: CRUD de porterías/portones nombrados, activo/inactivo,
  dirección y GPIO opcional.
- `guard-dashboard`: panel de guardia y vistas admin de bitácora y accesos.

### Modified Capabilities

- `database-schema`: access points, memberships, pass_scans, guard shifts y bitácora.
- `shared-types`: enums, tipos y DTOs de turnos, accesos y bitácora.
- `pass-scan-entry`: guard-only, turno obligatorio, access point y denegaciones en
  bitácora.
- `pass-lifecycle`: entradas de bitácora en confirmación y rechazo.
- `zima-mobile-auth` / `zima-guard-scan`: guard-only, turno y acceso.

## Impact

- **Database**: `packages/database/src/schema/` (`access-points`, `memberships`,
  `pass-scans`, `guard-shifts`, `guard-shift-segments`, `bitacora-entries`,
  `bitacora-comments`, `relations`, `index`), migración y trigger de inmutabilidad.
- **Shared**: `packages/shared/src/{enums,types,dto,index}.ts`.
- **API**: `server/api/src/services/{access-point,guard-shift,bitacora,access-scan,pass}.service.ts`;
  `server/api/src/routes/{access-point,guard-shift,bitacora,access}.routes.ts`;
  `schemas/index.ts`, `config.ts`, `index.ts`.
- **Dashboard**: `apps/dashboard/src/components/guard/GuardPanel.tsx`, nuevas páginas de
  accesos y bitácora, `App.tsx`, `AppSidebar.tsx`.
- **Zima**: `apps/zima-qr-access/src/{api,auth,app}`.
- **Depende de**: `add-dynamic-qr-access` (MVP implementado) y
  `add-zima-qr-access-app` (modo residente implementado).
- **No depende de**: `add-access-control-engine`, `add-device-abstraction`,
  `add-notification-service`, `add-delegated-subusers`.
