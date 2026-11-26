## Context

El alta de residentes hoy depende de que la persona ya exista como cuenta: `ResidentAssignmentPanel` ofrece un selector poblado con `/api/users` y publica `{ userId }` contra `POST /api/units/:id/residents`. El intento de invitación por correo existe y funciona para roles operativos, pero el dashboard solo lo expone en el formulario de plataforma (`PlatformPage`), no en la unidad ni en el árbol. Además la invitación guarda una sola `location_unit_id`, la membresía no está indexada por unidad lógica y el flujo de aceptación no deja registro en `location_residents`, que es la tabla que alimenta el panel de residentes.

Hallazgos que condicionan el diseño:

- `createInvitation` ya acepta `locationUnitId` para roles ocupantes y valida hoja con `validateLocationUnit`.
- `acceptInvitation` ya crea `people` + `accounts` + `memberships` para un correo nuevo, y devuelve tokens.
- `findMembership` filtra por `memberships.unitId` (legacy) e ignora `locationUnitId`: la detección de duplicados y la selección de membresía al aceptar pueden devolver otra unidad.
- `memberships_unique_idx` es `(person_id, organization_id, community_id, unit_id, role)`; con `unit_id` nulo y `NULLS DISTINCT`, no protege contra membresías repetidas por unidad lógica.
- `invitations` no tiene unicidad sobre invitaciones pendientes: se pueden duplicar correos para la misma unidad.
- No existe endpoint masivo de invitaciones; el precedente es `/api/passes/batch[/preview]` con parser CSV en el cliente.

## Goals / Non-Goals

**Goals:**

- Invitar por correo a alguien sin cuenta, desde la fila de una unidad y desde selección múltiple del árbol.
- Una invitación puede cubrir N unidades de la misma comunidad; al aceptar se crea una membresía y un registro de residente por unidad.
- Carga masiva por CSV con previsualización, validación por fila y resultado parcial.
- Corregir la deduplicación de membresías por `location_unit_id` para que el flujo sea idempotente.

**Non-Goals:**

- No se habilita registro público sin invitación.
- No se migra el modelo legacy `units` ni se elimina `invitations.unit_id`.
- No se agrega aprobación manual del alta: la invitación es la autorización.
- No se envía email transaccional nuevo: se reutiliza `sendInvitationEmail`.

## Decisions

### 1. Tabla puente `invitation_units`

Se agrega `invitation_units (invitation_id, location_unit_id, created_at)` con PK compuesta y `on delete cascade`. `invitations.location_unit_id` se conserva como unidad primaria para compatibilidad con preview, listados viejos y links ya emitidos; `createInvitation` escribe la primaria y todas las filas del puente.

**Por qué:** cambiar la columna por un array rompe preview, email y queries existentes; el puente permite multi-unidad sin big-bang y deja el camino abierto a borrar la columna más adelante.

**Alternativa descartada:** `uuid[]` en `invitations`; no permite FK ni índices por unidad.

### 2. Una membresía y un residente por unidad al aceptar

`acceptInvitation` recibe `locationUnitIds` desde el puente y, para cada unidad:

1. inserta `memberships` con `locationUnitId`, `communityId`, `organizationId` y el rol, con `onConflictDoNothing`;
2. inserta `location_residents` (`validFrom = today`, `relationship` derivada del rol: `owner` → `owner`, `tenant` → `tenant`, `resident` → `resident`, resto → `resident`), con `onConflictDoNothing` sobre el índice único `(unit, person, relationship)`.

Si todas las membresías ya existían, responde `409` (`already_member`); si al menos una es nueva, acepta y devuelve cuántas se crearon.

**Por qué:** la membresía habilita permisos; `location_residents` es lo que muestra el panel del árbol. Sin lo segundo, el residente invitado “no aparece” aunque tenga acceso.

### 3. Unicidad y deduplicación por unidad lógica

Migración `0039`:

- índice único parcial `memberships_person_location_unit_idx` sobre `(person_id, location_unit_id, role)` con `where location_unit_id is not null`;
- índice único parcial `invitations_pending_unit_idx` sobre `(email, community_id, location_unit_id)` con `where status = 'pending' and location_unit_id is not null`.

`findMembership` agrega `locationUnitId` como criterio cuando viene en el input, y `createInvitation` usa esa variante para detectar duplicados.

**Por qué:** el índice legacy no puede cubrir un nulo; y sin corregir `findMembership`, el duplicado se detecta contra la unidad equivocada y `switchContext` puede devolver otra membresía.

### 4. API: multi-unidad y lote

- `createInvitationSchema` acepta `locationUnitIds?: string[]` (1..50). Si viene, reemplaza a `locationUnitId`; si no, se mantiene el contrato actual. Todas las unidades deben pertenecer a la comunidad resuelta y ser hojas: si una falla, `400` con `unit_invalid` y el id.
- `POST /api/invitations/bulk/preview` y `POST /api/invitations/bulk` con `{ communityId, rows: [{ unit, email, name? }] }`, máximo 500 filas (`INVITATION_BATCH_MAX_ROWS`).
- La respuesta del lote es por fila: `{ index, status: 'created' | 'valid' | 'skipped' | 'failed', email, unitId?, message? }` más un `summary`. No es transaccional: una fila inválida no aborta el resto.
- El alcance se resuelve por fila con `resolveScope`; una fila fuera del alcance del actor falla con `forbidden` sin filtrar datos de otras comunidades.

**Por qué:** el lote de pases ya probó el patrón preview + create con resultado parcial; replicarlo reduce riesgo y mantiene la UX conocida.

### 5. Resolución de unidad en el CSV

La columna `unidad` se resuelve primero por `code` dentro de la comunidad seleccionada. Si el código no existe o está repetido, se intenta por path completo (`Nivel > Nivel > Unidad`) y, si sigue ambiguo, la fila se marca inválida con un mensaje que muestra los candidatos.

**Por qué:** los códigos son únicos por estructura, no globalmente; exigir path siempre haría el archivo más frágil para el caso común.

### 6. Parser CSV compartido

Se extrae el parser de `ResidentAuthorizationBulkPage` a `apps/dashboard/src/lib/csv.ts` (detección de delimitador, comillas, BOM, normalización de encabezados) y ambas páginas lo consumen. Se mantiene el comportamiento actual del lote de pases y se agregan tests del parser.

**Por qué:** ya hay un parser probado en producción; duplicarlo garantiza que uno de los dos se rompa primero.

### 7. Superficie del dashboard

- `UnitsPage` (rutas `admin/units` y `platform/units`): columna de acciones con `Invitar residente` solo en hojas y solo para `org_admin`/`community_admin` (plataforma: admin de plataforma). Checkboxes de selección + barra “Invitar a N unidades” + botón “Carga masiva”.
- `LocationTreeTable` (dentro de `StructureTreeWorkspace`): acción `Invitar residente` junto a `Residentes` en hojas, y selección múltiple con la misma barra.
- Diálogo compartido `ResidentInviteDialog` (`components/admin/`): correo libre, rol (`resident` por defecto, `tenant`/`owner` opcionales), lista de unidades con opción de quitar, submit con pending y error inline. En éxito muestra el link una vez y el estado del envío de correo.
- `AdminPanel` (pestaña Invitaciones): las pendientes muestran comunidad y chips de unidades; se agrega “Carga masiva”.
- `InvitePage`: agrega teléfono y documento opcionales al formulario de cuenta nueva; el preview lista todas las unidades.
- `MyOrganizationPage`/perfil: sin cambios; el residente ya puede editar sus datos después de aceptar.

### 8. Autorización

Se reutiliza `resolveScope` + `canManage`. Se agrega la verificación de que cada unidad pertenezca a la comunidad resuelta y que el actor pueda administrarla. `community_admin` no puede invitar fuera de su comunidad ni cambiar el rol a uno operativo (se restringe a roles ocupantes en este flujo).

### 9. Activación de cuentas creadas por el administrador

**Decisión:** el alta directa desde Usuarios deja de recibir contraseña y usa el mismo
mecanismo de token de un solo uso que el restablecimiento.

- `POST /api/users` pierde `password` del esquema. La cuenta se crea con un hash
  aleatorio de 32 bytes, inutilizable, para que nadie pueda autenticarse hasta activar.
- Después del commit se emite el token con `issueResetToken(accountId, ip)` (60 minutos,
  invalida los anteriores) y se envía un correo «Activá tu cuenta» que reutiliza el
  cuerpo del restablecimiento. Si el envío falla, la cuenta queda creada y la respuesta
  devuelve `emailSent: false` + `activationUrl` una sola vez, igual que las invitaciones.
- Nuevo `POST /api/users/:id/activation` para reenviar: misma autorización que el alta
  (plataforma, `org_admin` de la organización o `community_admin` de la comunidad),
  `409 already_active` si la cuenta ya eligió contraseña.
- La página pública es la existente `/reset-password?token=…`; solo cambia el copy
  cuando el token viene de una activación. No se agrega una ruta nueva.
- `mail.service` gana `sendAccountActivationEmail`, reutilizando
  `buildPasswordResetBodies` con asunto y texto de bienvenida.

**Alternativa descartada:** que el admin elija y envíe la contraseña por correo (opción
B). Queda una credencial en texto plano en dos lugares y obliga a cambiarla igual.

## Data model

```
invitations (existente)
  + unidades vía invitation_units (nueva)

invitation_units
  invitation_id      uuid  PK, FK invitations(id) on delete cascade
  location_unit_id   uuid  PK, FK location_units(id) on delete cascade
  created_at         timestamptz

memberships
  + índice único parcial (person_id, location_unit_id, role) where location_unit_id is not null

invitations
  + índice único parcial (email, community_id, location_unit_id) where status='pending'
```

## API contracts

`POST /api/invitations`

```json
{
  "email": "residente@ejemplo.com",
  "role": "resident",
  "organizationId": "uuid",
  "communityId": "uuid",
  "locationUnitIds": ["uuid", "uuid"],
  "expiresInDays": 7
}
```

Respuesta `201`: `{ invitation: { id, email, role, status, expiresAt, units: [{ id, code, path }] }, acceptUrl, emailSent }`.

`POST /api/invitations/bulk/preview`

```json
{ "communityId": "uuid", "rows": [{ "unit": "A-101", "email": "a@b.co", "name": "Ana" }] }
```

Respuesta `200`: `{ summary: { total, valid, invalid, duplicate }, rows: [{ index, status, email, unit?, unitId?, message? }] }`.

`POST /api/invitations/bulk` → `{ summary: { total, created, skipped, failed }, results: [...] }`.

Errores: `400` payload inválido o unidad fuera de la comunidad; `403` fuera de alcance; `409` miembro existente; `429` rate limit existente.

## Migration / Rollback

- La migración crea `invitation_units` y los índices parciales; es aditiva.
- Backfill: por cada invitación con `location_unit_id` no nulo se inserta su fila en el puente (`on conflict do nothing`).
- Rollback: se pueden eliminar los índices y la tabla sin tocar datos de `invitations`; el código vuelve a leer `location_unit_id`.

## Testing

- Unitarios: resolución de unidad por código/path y parser CSV.
- Integración (`server/api/test/invitations.integration.test.ts`): invitación multi-unidad, duplicado por unidad, aceptación creando N membresías y N residentes, aceptación con todas las membresías existentes (409), autorización por comunidad, lote con filas válidas e inválidas.
- Migración: `schema-migration.integration.test.ts` verifica que los índices existan y que el backfill sea idempotente.
- Dashboard: sin runner de tests; verificación manual con `eslint` + build y prueba en staging con una comunidad de demo.

## Risks / Trade-offs

- **Doble escritura** de `invitations.location_unit_id` y `invitation_units`: se mitiga escribiendo siempre ambos y leyendo el puente con fallback a la columna.
- **`location_residents` con validFrom obligatorio**: se usa la fecha de aceptación; si el edificio necesita vigencia retroactiva, se ajusta después desde el panel.
- **Lote parcial**: el usuario puede reintentar el mismo archivo; la deduplicación por índice parcial evita duplicados, y el preview marca los ya invitados.
- **500 filas** es un límite de producto, no técnico; se deja configurable por constante compartida.
