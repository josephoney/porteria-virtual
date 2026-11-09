## Why

La auditoría encontró problemas P0/P1 que bloquean exponer la plataforma: el signaling
no autentica ni aísla por comunidad y permite abrir puertas/relés sin validar rol o
tenant; el superadmin rompe los paneles de tenant con 500; un `community_admin` puede
crear un `org_admin`; un residente puede entrar al panel de operador y al socket de
operador; y el `rpi_id` duplicado/legacy desvía llamadas y datos.

## What Changes

- **Signaling autenticado**: handshake con JWT, rol y comunidad derivados del token;
  rooms `community:{id}`; filtrar kiosks/llamadas por comunidad; validar rol/comunidad en
  `door:open` y `relay:trigger`.
- **Kiosk autenticado**: token de dispositivo/kiosk; no confiar en `communityId` del
  payload.
- **Contexto de plataforma aislado**: en contexto platform, los endpoints de tenant no
  deben devolver 500; el dashboard oculta Operador/Admin/Guardia y deja `/platform`.
- **Guardrail de roles**: `community_admin` no puede crear `org_admin`; se centraliza la
  política de asignación de roles.
- **Ruteo por rol**: `/` protegido; el residente no entra al panel de operador; el socket
  de operador solo se abre para roles operativos.
- **Identidad de kiosk**: `rpi_id` único o resolución por `communityId + rpiId`; el
  tenant legacy se deja aislado y su limpieza destructiva queda como follow-up con
  backup y ventana de mantenimiento.
- **Alcance de llamadas**: solo `operator` se limita a sus propias llamadas;
  `community_admin` ve su comunidad y `org_admin` su organización.
- **Non-goals:** no se rediseña el QR dinámico, ni la jerarquía de ubicaciones, ni el
  modelo de personas/subusuarios (van en propuestas separadas).

## Capabilities

### New Capabilities

- `signaling-authorization`: autenticación de sockets, rooms por comunidad y autorización
  de actuación.
- `platform-context-isolation`: comportamiento seguro del contexto de plataforma.
- `tenant-role-guardrails`: restricciones de asignación de roles, ruteo por rol y alcance
  de llamadas.
- `kiosk-tenant-identity`: identidad única de kiosks y resolución por tenant.

### Modified Capabilities

- `membership-rbac`: política de asignación de roles.
- `kiosk-management-api`: resolución/identidad por comunidad.
- `database-schema`: unicidad de `rpi_id` y limpieza de datos legacy.

## Impact

- **Signaling**: `server/signaling/src/*` (auth, rooms, handlers, state).
- **API**: rutas de kiosks/calls/events/reports/communities, RBAC, users.
- **Dashboard**: `SocketContext`, `App.tsx`, `AppSidebar`, `UsersTable`, `OperatorPanel`.
- **DB**: migración de unicidad/limpieza de kiosks/data legacy.
- **Depende de:** nada (foundation/tenant entry/outbox archivados).
- **Prioridad:** P0/P1, primera en ejecutarse.
