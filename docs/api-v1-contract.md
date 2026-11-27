# Contrato de API v1

**Estado:** congelado para la primera puesta en producción.
**Versión de API:** `v1` (`contract: 1`).
**Verificación:** `GET /api/version` y `server/api/test/api-contract.test.ts`.

## 1. Reglas del contrato

- Todo lo que cuelga de `/api` se considera **v1**.
- Los cambios **aditivos** (nuevos campos opcionales, nuevos endpoints, nuevos códigos de error) son compatibles y no cambian la versión.
- Los cambios **rompientes** (renombrar/quitar campos, cambiar tipos, cambiar semántica de códigos, cambiar rutas) van a `/api/v2`.
- Los clientes deben ignorar campos desconocidos y no depender del orden de las claves.
- Los IDs son UUID v4 en formato string.
- Las fechas son ISO 8601 en UTC (`2026-11-10T12:00:00.000Z`) salvo que se indique lo contrario.
- Las horas de ventana diaria (`timeFrom`, `timeTo`) son `HH:MM` o `HH:MM:SS` en la zona horaria de la comunidad.

## 2. Base URLs

| Entorno    | API                                 | Dashboard               | Pases públicos            |
| ---------- | ----------------------------------- | ----------------------- | ------------------------- |
| Desarrollo | `http://localhost:3000`             | `http://localhost:5174` | `http://localhost:5176`   |
| Producción | `https://app.<dominio>/api` (proxy) | `https://app.<dominio>` | `https://pases.<dominio>` |
| Móvil      | `EXPO_PUBLIC_API_URL`               | —                       | —                         |

En producción el dashboard y pass-web hablan con `/api` en su mismo origen; Caddy/Nginx lo proxya a `api:3000`.

## 3. Autenticación

- `POST /api/auth/login` devuelve `accessToken` (15 min) y `refreshToken` (7 días).
- Las rutas autenticadas usan `Authorization: Bearer <accessToken>`.
- `POST /api/auth/refresh` renueva el par de tokens.
- `POST /api/auth/context` cambia de contexto (membership) y devuelve un token nuevo.
- `POST /api/auth/logout` revoca el refresh token.
- El JWT incluye `sub`, `accountId`, `personId`, `email`, `orgId`, `membershipId`, `role`, `communityId`, `unitId`, `isPlatformAdmin`.

### Roles

`org_admin`, `community_admin`, `operator`, `guard`, `owner`, `tenant`, `resident`, `staff`.
El platform admin es un flag (`isPlatformAdmin`), no un rol.

## 4. Formato de error

Todas las rutas devuelven el mismo sobre:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Validation error",
  "details": [{ "path": "email", "message": "Invalid email" }]
}
```

- `details` solo aparece en errores de validación Zod.
- En errores de pases, `message` es el **código estable** (por ejemplo `pass_used`, `not_bound`), no una frase para mostrar al usuario.
- Los clientes deben mapear `message` a su propio texto.

### Códigos HTTP

| Código | Uso                                                     |
| ------ | ------------------------------------------------------- |
| 200    | OK                                                      |
| 201    | Creado                                                  |
| 400    | Validación, token QR inválido o formato incorrecto      |
| 401    | Sin token, token inválido/expirado, membership inválida |
| 403    | Rol insuficiente, fuera de comunidad, PIN incorrecto    |
| 404    | Recurso o link inexistente, feature deshabilitada       |
| 409    | Conflicto: replay, escaneo expirado, turno ya procesado |
| 410    | Link/pase expirado, revocado o ya usado                 |
| 429    | Rate limit, PIN bloqueado o límite diario de pases      |
| 500    | Error interno                                           |
| 503    | API no lista (base de datos)                            |

### Códigos de error de pases

`not_found`, `forbidden`, `conflict`, `gone`, `invalid`, `recurring_not_available`, `allowed_days_reserved`, `link_expired`, `pass_used`, `not_bound`, `device_already_bound`, `invalid_pin`, `pin_locked`, `not_valid_now`, `dynamic_qr_disabled`, `invalid_or_expired_token`, `token_already_used`, `scan_expired`, `scan_already_processed`, `pass_expired`, `daily_limit_reached`, `rate_limited`, `no_active_shift`, `not_on_shift_at_access_point`, `foreign_community`, `structure_already_exists`, `structure_has_units_at_removed_level`.

## 5. Endpoints congelados

### 5.1 Sistema

| Método | Ruta            | Auth | Descripción                                |
| ------ | --------------- | ---- | ------------------------------------------ |
| GET    | `/health`       | No   | Liveness, versión y timestamp              |
| GET    | `/ready`        | No   | Readiness con chequeo de base de datos     |
| GET    | `/metrics`      | No   | Métricas Prometheus (solo red interna)     |
| GET    | `/api/version`  | No   | `{ api: "v1", contract: 1, version, env }` |
| GET    | `/api/features` | No   | Flags de funcionalidad                     |

### 5.2 Autenticación

| Método | Ruta                | Descripción               |
| ------ | ------------------- | ------------------------- |
| POST   | `/api/auth/login`   | Login por email/password  |
| POST   | `/api/auth/refresh` | Renovar tokens            |
| POST   | `/api/auth/context` | Cambiar membership activa |
| POST   | `/api/auth/logout`  | Revocar refresh token     |

### 5.3 Público

| Método | Ruta                                    | Descripción                                           |
| ------ | --------------------------------------- | ----------------------------------------------------- |
| GET    | `/api/public/communities/:slug`         | Datos públicos de la comunidad                        |
| GET    | `/api/public/invitations/:token`        | Preview de invitación                                 |
| POST   | `/api/public/invitations/:token/accept` | Aceptar invitación                                    |
| GET    | `/api/public/passes/:token`             | Preview del pase (documento enmascarado)              |
| POST   | `/api/public/passes/:token/bind`        | Vincular el primer dispositivo (cookie `pass_device`) |
| GET    | `/api/public/passes/:token/qr`          | QR rotativo (24 s)                                    |
| GET    | `/api/public/passes/:token/status`      | Estado del pase y presencia                           |

### 5.4 Pases (residente)

| Método | Ruta                              | Descripción                                |
| ------ | --------------------------------- | ------------------------------------------ |
| POST   | `/api/passes`                     | Crear pase                                 |
| GET    | `/api/passes`                     | Listar pases propios (`status?`, paginado) |
| GET    | `/api/passes/:id`                 | Detalle con `locationPath`                 |
| POST   | `/api/passes/:id/revoke`          | Revocar pase                               |
| POST   | `/api/passes/:id/regenerate-link` | Regenerar link y desvincular dispositivo   |
| GET    | `/api/passes/:id/qr`              | QR del residente (sin binding público)     |

### 5.5 Acceso y escaneo (guardia)

| Método | Ruta                            | Descripción                         |
| ------ | ------------------------------- | ----------------------------------- |
| POST   | `/api/access/scan`              | Escanear QR; requiere turno abierto |
| POST   | `/api/access/scans/:id/confirm` | Confirmar ingreso/egreso            |
| POST   | `/api/access/scans/:id/reject`  | Rechazar escaneo                    |
| GET    | `/api/access/scans`             | Historial del guardia (paginado)    |

### 5.6 Turnos de guardia

| Método | Ruta                                        | Rol                               |
| ------ | ------------------------------------------- | --------------------------------- |
| GET    | `/api/guard/shifts/current`                 | guard                             |
| POST   | `/api/guard/shifts/start`                   | guard                             |
| POST   | `/api/guard/shifts/:id/change-access-point` | guard                             |
| POST   | `/api/guard/shifts/:id/end`                 | guard                             |
| POST   | `/api/guard/shifts/:id/force-close`         | community_admin, org_admin        |
| GET    | `/api/guard/shifts`                         | guard, community_admin, org_admin |
| GET    | `/api/guard/active-guards`                  | community_admin, org_admin        |

### 5.7 Bitácora de accesos

| Método | Ruta                         | Rol                               |
| ------ | ---------------------------- | --------------------------------- |
| GET    | `/api/bitacora`              | guard, community_admin, org_admin |
| GET    | `/api/bitacora/:id`          | guard, community_admin, org_admin |
| POST   | `/api/bitacora`              | guard (en su acceso), admin       |
| POST   | `/api/bitacora/:id/comments` | guard (en su acceso), admin       |

La bitácora es inmutable: no hay `PATCH` ni `DELETE`.

### 5.8 Accesos físicos

| Método | Ruta                                              | Rol                                      |
| ------ | ------------------------------------------------- | ---------------------------------------- |
| GET    | `/api/communities/:communityId/access-points`     | org_admin, community_admin, guard        |
| POST   | `/api/communities/:communityId/access-points`     | org_admin, community_admin               |
| PATCH  | `/api/communities/:communityId/access-points/:id` | org_admin, community_admin               |
| DELETE | `/api/communities/:communityId/access-points/:id` | org_admin, community_admin (baja lógica) |
| GET    | `/api/communities/:communityId/access-points/:accessPointId/guards` | org_admin, community_admin |

### 5.8.1 Puesto de trabajo del guardia

| Método | Ruta                               | Rol                        |
| ------ | ---------------------------------- | -------------------------- |
| PUT    | `/api/memberships/:id/workstation` | org_admin, community_admin |
| GET    | `/api/me/workstation`              | cualquier autenticado      |

Body del `PUT`: `{ "accessPointId": "uuid" | null }`. Solo aplica a membresías `guard`
con comunidad y a un acceso activo de esa comunidad; `null` desasigna y es idempotente.
La asignación es informativa: no restringe en qué acceso inicia turno el guardia.

### 5.9 Administración de comunidad y ubicaciones

| Grupo              | Rutas base                                                                      |
| ------------------ | ------------------------------------------------------------------------------- |
| Comunidades        | `/api/communities`, `/:id/overview`, `/:id`, `/:id/buildings`, `/:id/units`     |
| Estructuras        | `/api/location-structures`, `/api/communities/:communityId/location-structures` |
| Nodos de ubicación | `/api/location-units`, `/:id`, `/:id/archive`, `/:id/restore`, `/:id/move`      |
| Secciones          | `/api/sections`, `/:id`                                                         |
| Unidades legadas   | `/api/units`, `/:id`                                                            |
| Membresías         | `/api/memberships`, `/:id` (PATCH inactiva, DELETE borra), `/:id/workstation` (PUT) |
| Invitaciones       | `/api/invitations`, `/:id/revoke`, `/:id/resend`                                |
| Personas           | `/api/people`, `/:id`                                                           |
| Usuarios           | `/api/users`, `/:id`, `/api/me`, `/api/me/password`                             |
| Activos            | `/api/assets`, `/:id`, `/:id/content`                                           |
| Organización       | `/api/organizations/me`, `/me/communities`                                      |
| Plataforma         | `/api/platform/*` (solo platform admin; tenant read-only)                       |
| Kioscos            | `/api/kiosks`, `/:id/device-token`, `/resolve`, `/stats`                        |
| Llamadas           | `/api/calls`, `/:id`, `/:callId`                                                |
| Eventos            | `/api/events`, `/api/events/stats`                                              |
| Reportes           | `/api/reports/daily`, `/weekly`, `/monthly`, `/call-stats`, `/event-breakdown`  |
| Relés              | `/api/kiosks/:kioskId/relays`, `/api/relays/trigger`                            |

Cada comunidad tiene como máximo una estructura de ubicación. `location_structures.community_id` es único; `POST /api/location-structures` responde `409 structure_already_exists` si ya existe una, y `PATCH /api/location-structures/:id` responde `409 structure_has_units_at_removed_level` al intentar reducir niveles con unidades. `GET /api/communities/:id/overview` incluye `structureSummary` (o `null`).

`organizations` y `communities` agregan `municipality`, `department` y `country` (`varchar(120)`, nullable). Las altas nuevas usan `Colombia` por defecto; los registros históricos quedan en `null` y la UI los muestra como `—`. Los tres campos viajan en `GET/PATCH /api/organizations/me`, `POST /api/organizations/me/communities`, `PATCH /api/communities/:id` y `GET /api/platform/organizations/:id/overview`.

`PATCH /api/platform/organizations/:id` acepta `{ name?, slug?, administratorEmail? }` (solo platform admin) y responde `{ organization, administrator }`. Cambiar el administrador a un correo con cuenta transfiere el rol en el acto y desactiva los `org_admin` anteriores; a un correo sin cuenta crea una invitación `org_admin`, mantiene activo al administrador actual y devuelve `acceptUrl` una única vez. Nombre duplicado responde `409 organization_name_taken`; organización inexistente, `404`.

### 5.10 Internos

`/api/internal/*` es para signaling, MQTT bridge y workers. Requiere `X-Internal-Api-Key`; no es parte del contrato de clientes.

## 6. DTOs congelados (resumen)

### Login

```json
{
  "accessToken": "…",
  "refreshToken": "…",
  "user": { "id": "uuid", "email": "…", "name": "…", "isPlatformAdmin": false },
  "activeMembership": {
    "id": "uuid",
    "role": "owner",
    "organizationId": "uuid",
    "communityId": "uuid",
    "unitId": "uuid|null",
    "locationUnitId": "uuid|null",
    "defaultAccessPointId": "uuid|null"
  }
}
```

### `OrganizationAdministrator`

`{ status: "active", userId, email, name } | { status: "pending", email, invitationId, acceptUrl } | null`.

### `AccessPass`

Incluye `id`, `communityId`, `locationUnitId`, `structureId`, `createdByPersonId`, `authorizedByPersonId`, `visitorFirstName`, `visitorLastName`, `visitorDocument`, `hasVehicle`, `vehiclePlate`, `type`, `validFrom`, `validUntil`, `status`, `presenceState`, `linkExpiresAt`, `pinEnabled`, `entryAt`, `exitAt`, `entryCount`, `exitCount`. **Nunca** incluye `linkToken`, `qrToken` ni hashes.

### `ScanPassResponse`

```json
{
  "scanId": "uuid|null",
  "authorized": true,
  "action": "entry|exit|null",
  "result": "authorized|denied",
  "reason": "string|null",
  "visitor": { "firstName": "…", "lastName": "…", "document": "…" },
  "vehiclePlate": "string|null",
  "locationPath": "General / Torre A / Piso 1 / A-101",
  "authorizedByName": "…",
  "schedule": {
    "validFrom": "…",
    "validUntil": "…",
    "timeFrom": "HH:MM|null",
    "timeTo": "HH:MM|null"
  },
  "presenceState": "outside|inside",
  "status": "pending|confirmed|rejected|expired|null",
  "accessPointId": "uuid",
  "accessPointName": "Puerta Principal",
  "shiftId": "uuid",
  "bitacoraEntryId": "uuid|null"
}
```

### `ScanDecisionResponse`

`{ scanId, status, action, passStatus, presenceState, bitacoraEntryId }`.

### `PublicPassPreview`

`{ communityName, visitorFirstName, maskedDocument, locationPath, validFrom, validUntil, timeFrom, timeTo, vehiclePlate, status, presenceState, pinRequired }`.

### `BitacoraEntryDto`

`{ id, communityId, accessPointId, accessPointName, shiftId, type, source, authorName, passId, passScanId, summary, details, destinationPath, authorizedByName, commentCount, createdAt }`.

### `GuardShiftCurrentResponse`

`{ shift, segment, accessPoint, stale, elapsedSeconds }`.

## 7. Rate limits

| Operación                    | Límite                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Login                        | 10 intentos fallidos/min por IP + email; un login exitoso reinicia el contador |
| Preview de pase público      | 60/min por IP + token                                                          |
| Bind de pase público         | 20/min por IP + token                                                          |
| QR público                   | 60/min por IP + token                                                          |
| Status público               | 120/min por IP + token                                                         |
| Creación de pases por unidad | `PASS_DAILY_LIMIT_PER_UNIT` (20 por defecto)                                   |
| PIN incorrecto               | 5 intentos, bloqueo 15 min                                                     |

## 8. Versionado y deprecación

- `GET /api/version` es la fuente de verdad: `api: "v1"`, `contract: 1`.
- No se eliminan campos ni endpoints dentro de v1.
- Un cambio rompiente se publica como `/api/v2`; v1 sigue funcionando al menos 6 meses.
- Las versiones viejas de la app móvil deben seguir funcionando; si un cambio requiere migración, se negocia una ventana de actualización.
- Los códigos de error son parte del contrato: no se renombran.

## 9. Prueba de contrato

`server/api/test/api-contract.test.ts` verifica:

- `/health`, `/ready`, `/api/version`, `/api/features`.
- Formato de error `{ statusCode, error, message }`.
- 401 en rutas protegidas sin token.
- 404 en rutas inexistentes.
- Que los prefijos críticos (`/api/passes`, `/api/access`, `/api/bitacora`, `/api/guard`) existan.
