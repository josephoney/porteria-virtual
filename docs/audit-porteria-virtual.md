# Auditoría de Portería Virtual

Fecha: 2026-11-05

## 1. Resumen ejecutivo

La plataforma tiene una base sólida: monorepo pnpm, API Fastify, PostgreSQL +
TimescaleDB, outbox confiable, autenticación JWT con contexto de membresía, consola de
plataforma, invitaciones y un dashboard React. El flujo de QR dinámico está
**especificado pero no implementado**. La app móvil Zima QR Access también está
especificada, no implementada.

Los riesgos principales no están en el QR: están en el **dashboard y el signaling
legacy**. El signaling no autentica operadores ni aísla por comunidad, y el dashboard
permite que un residente entre al panel de operador y se registre como operador. Además,
un `community_admin` puede crear un `org_admin`.

## 2. Arquitectura y stack

| Capa | Tecnología |
|---|---|
| Monorepo | pnpm workspaces |
| Frontends | `apps/dashboard`, `apps/kiosk`, `apps/resident` (stub) |
| Paquetes | `@porteria/shared`, `@porteria/database` |
| API | Fastify 5 + TypeScript + Zod |
| ORM | Drizzle 0.36 + migraciones |
| Auth | JWT access/refresh + bcrypt |
| DB | PostgreSQL 16 + TimescaleDB |
| Cache | Redis 7 |
| IoT | Mosquitto MQTT + mqtt.js |
| Realtime | Socket.io (signaling) |
| WebRTC | Nativo + coturn |
| Dashboard UI | React 18, Vite 5, Tailwind CSS 4, shadcn/ui (Radix), Lucide, Recharts, Manrope + IBM Plex Mono |
| Tests | **No hay tests** en el repo |

### Frontend

- **Sí usa React + Tailwind CSS + shadcn/ui + Lucide.**
- Componentes shadcn en `apps/dashboard/src/components/ui`: button, input, label, field,
  card, table, tabs, dialog, sheet, sidebar, badge, alert, select, tooltip, separator,
  skeleton.
- Tokens de color en `apps/dashboard/src/index.css` con OKLCH; radios y fuentes
  definidos en `@theme`.
- `App.css` mantiene tokens legacy y estilos propios; el kiosk tiene su propio CSS.
- No hay Storybook, documentación de componentes ni catálogo visual.
- Dark mode incompleto: existe `.dark` pero solo define algunos `--*-bg`, no todos los
  tokens.
- Algunos botones icon-only no tienen `aria-label`; no hay sistema de toasts; hay
  etiquetas mezcladas en español/inglés.

## 3. Modelo de datos actual

Entidades implementadas:

- `organizations`, `communities` (con `slug`), `buildings`, `units`.
- `users` (global, email único, `is_platform_admin`).
- `memberships` (usuario ↔ organización/comunidad/unidad con rol).
- `invitations` (token hash, expiración, aceptación).
- `visitors`, `access_codes`.
- `calls`, `events` (hypertable), `guard_rounds`, `guard_checkpoints`.
- `kiosks`, `access_points`, `relay_outputs`.
- `refresh_tokens`, `outbox_events`, `ingested_events`.

Limitaciones relevantes:

- `buildings` y `units` son **rígidos**: no permiten jerarquías configurables ni nombres
  personalizados.
- `users` mezcla **persona** y **cuenta**; no hay separación conceptual.
- No hay subusuarios ni permisos delegados.
- No hay `location_nodes` genéricos; el QR dinámico especificado usa `unitId`.
- El `rpi_id` de kiosks no es único globalmente (hay dos `edificio-01`).

## 4. Roles, permisos y autenticación

Roles actuales: `org_admin`, `community_admin`, `operator`, `guard`, `owner`, `tenant`,
`resident`, `staff`; `is_platform_admin` para superadmin.

- JWT con contexto activo: `orgId`, `membershipId`, `role`, `communityId`, `unitId`.
- Login con selección de contexto para múltiples membresías.
- RBAC REST por rol.
- `/platform` solo para `isPlatformAdmin`.
- `/admin` para `org_admin`/`community_admin`.
- `/guard` para `org_admin`/`guard`.
- `/` **no tiene guard de rol**.
- Signaling **no autentica** sockets ni aísla por comunidad.

## 5. Dashboards y funcionalidades

### Implementado

- Login, selección de contexto, logout, refresh.
- Consola de plataforma (`/platform`): organizaciones, comunidades, torres, unidades,
  invitaciones.
- Admin (`/admin`): usuarios, historial de llamadas, bitácora, reportes.
- Operador (`/`): cola de llamadas, kiosks, videollamada, relés, historial propio.
- Guardia (`/guard`): placeholder “Próximamente en Fase 4”.
- Página pública de comunidad (`/c/:slug`) y aceptación de invitación (`/invite/:token`).

### Parcial

- Guardia: sin funcionalidad real.
- Residente: sin dashboard ni app; `apps/resident` es un stub.
- Superadmin: los paneles de tenant fallan con 500.
- Invitaciones: API disponible para org/community admin, sin UI.
- Kiosks: identidad ambigua por `rpi_id` duplicado.
- Llamadas: el community_admin solo ve las propias.

### Pendiente / solo especificado

- QR dinámico (`add-dynamic-qr-access`).
- Servicio de notificaciones Expo (`add-notification-service`).
- App Zima QR Access (`add-zima-qr-access-app`).
- Motor de acceso genérico, biometría y dispositivos (parkeados).
- Intercomunicador a residentes, visitas, paquetería, finanzas, etc.

## 6. Hallazgos P0/P1

### P0 — Signaling sin autenticación ni aislamiento multi-tenant

- `operator:register` acepta cualquier socket sin JWT; el cliente envía
  `operatorId`/`communityId`.
- `door:open` y `relay:trigger` no validan rol ni comunidad; cualquier operador
  registrado puede abrir puertas de cualquier kiosco si conoce el id.
- `call:incoming` y `kiosks:update` se emiten a una única room `operators`, sin filtrar
  por comunidad.
- El dashboard registra como operador a **cualquier usuario autenticado**, incluido un
  residente.

### P1 — Superadmin rompe paneles de tenant

- `/api/communities`, `/api/kiosks`, `/api/calls`, `/api/events` y `/api/reports`
  devuelven 500 con el token de plataforma porque `orgId = ''` se compara contra columnas
  UUID.

### P1 — Escalada de privilegios

- Un `community_admin` puede crear un `org_admin` desde `POST /api/users` (probado: 201).
- El formulario de usuarios le muestra la opción `org_admin`.

### P1 — Residente en el dashboard

- `/` no está protegido por rol; renderiza el panel de operador.
- El socket se registra como operador y expone kiosks/llamadas.

### P1 — `rpi_id` duplicado y datos legacy

- Existen dos kiosks `edificio-01`: Torre Norte y la legacy Torre Principal.
- El resolve por `rpiId` devuelve el legacy; las llamadas nuevas quedan en la
  organización legacy.
- La organización “Edificio Demo” tiene 0 memberships y 97 llamadas huérfanas.

### P2 — Otros

- `community_admin` ve solo sus propias llamadas, no las de su comunidad.
- Panel de guardia vacío.
- Invitaciones sin UI para org/community admin.
- Superadmin ve una lista global de usuarios en Admin.

## 7. Funcionalidades afectadas por los cambios propuestos

- QR dinámico: debe dejar de depender de `unitId` fijo y pasar a `location_node`/
  `location_unit`.
- Memberships y usuarios: se separan persona/cuenta y se agregan subusuarios.
- Dashboard: navegación, permisos y consola de plataforma.
- Signaling y panel de operador: autenticación y aislamiento.
- Notificaciones y app Zima: autorizaciones, destinatarios y trazabilidad.
- Reportes/bitácora: nuevas entidades y filtros.

## 8. Estado OpenSpec

Archivados:

- `establish-domain-foundation`
- `add-tenant-entry-and-platform-console`
- `add-reliable-event-outbox`

Activos:

- `add-dynamic-qr-access` (94 tareas)
- `add-notification-service` (65 tareas)
- `add-zima-qr-access-app` (64 tareas)
- parkeados: `add-access-control-engine`, `add-biometric-access`,
  `add-device-abstraction`

## 9. Propuestas a generar

| # | Change | Prioridad | Depende de |
|---|---|---|---|
| 1 | `fix-critical-security-and-tenant` | P0/P1 | — |
| 2 | `standardize-dashboard-ux` | P2 | — (puede ir en paralelo) |
| 3 | `extend-admin-hierarchy` | P1 | 4, 5 |
| 4 | `add-configurable-location-hierarchy` | P1 | — |
| 5 | `separate-people-and-accounts` | P1 | — |
| 6 | `add-delegated-subusers` | P2 | 3, 5 |
| 7 | `align-qr-access-with-locations` | P1 | 3, 4, 5, 6 |

Orden recomendado: **1 → 4/5 → 3 → 6 → 7 → 2**. La UX/UI puede definirse en paralelo,
pero se aplica después de estabilizar las pantallas administrativas.

## 10. Recomendaciones

1. No exponer el dashboard actual a producción hasta cerrar el P0 de signaling.
2. Corregir la escalada de roles antes de habilitar onboarding.
3. Resolver el `rpi_id` duplicado y limpiar/migrar la data legacy.
4. Separar persona/cuenta y adoptar la jerarquía de ubicaciones antes de construir las
   pantallas administrativas nuevas.
5. Extender las capacidades existentes (foundation, tenant entry, memberships) en lugar
   de duplicarlas.
6. Revisar y aprobar las 7 propuestas antes de implementar.
