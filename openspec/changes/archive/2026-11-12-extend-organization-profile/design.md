# Design: perfil geográfico y edición de organización

## Context

`organizations` tiene `name`, `slug`, `nit`, `phone`, `address`, `legalRepresentativePersonId`, `logoAssetId` y `welcomeMessage`. `communities` tiene `name`, `slug`, `address`, `phone`, `type`, `typeLabel`, `latitude`, `longitude`, `timezone`, `logoAssetId` y `welcomeMessage`. Ninguna de las dos tiene ubicación administrativa.

La edición de organizaciones existe a medias: `PATCH /api/platform/organizations/:id` acepta `name` y `slug`, audita `organization.updated`, pero no hay UI que lo llame y no hay forma de cambiar al administrador. `GET /api/platform/organizations/:id/overview` ya devuelve `administrator` (nombre, email, estado) y `pendingAdministrator` (invitación pendiente), así que la información para mostrar el estado actual ya está resuelta; falta la escritura.

El login valida contra `users` (email + `passwordHash`). `memberships.userId` referencia `users.id`. Las invitaciones se crean con `createInvitation` y se materializan en `acceptInvitation`.

## Goals

- Guardar municipio, departamento y país de organizaciones y comunidades.
- Exponerlos en los formularios y en los detalles sin romper registros existentes.
- Permitir que un platform admin corrija el nombre de una organización y transfiera su administrador.
- Que la transferencia nunca deje la organización sin administrador activo.

## Non-goals

- Catálogo ISO-3166 ni tabla de países.
- Catálogo de departamentos/municipios o validación jerárquica.
- Geocodificación o autocompletado.
- Edición del slug desde el diálogo de plataforma.
- Edición del nombre de la organización desde Mi Organización.

## Decisions

### 1. Columnas nullable, sin default en base de datos

```sql
ALTER TABLE organizations
  ADD COLUMN municipality varchar(120),
  ADD COLUMN department varchar(120),
  ADD COLUMN country varchar(120);

ALTER TABLE communities
  ADD COLUMN municipality varchar(120),
  ADD COLUMN department varchar(120),
  ADD COLUMN country varchar(120);
```

Sin `NOT NULL` y sin `DEFAULT`: los registros existentes no tienen país real y ponerles "Colombia" en la migración sería inventar datos. El default “Colombia” es una decisión de formulario, no de esquema.

La migración se genera con `pnpm --filter @porteria/database db:generate` y se revisa a mano; queda como `0016_*`. El rollback (`DROP COLUMN`) pierde los datos cargados, así que se documenta como migración de una sola dirección después de un backup.

### 2. Un schema de geografía reutilizado

En `server/api/src/schemas/index.ts`:

```ts
export const geographySchema = z.object({
  municipality: z.string().max(120).nullable().optional(),
  department: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
});
```

Se extiende con `.merge(geographySchema)` (o spread) en `createOrganizationSchema`, `updateOrganizationSchema`, `createCommunitySchema` y `updateCommunitySchema`. El body de `PATCH /api/organizations/me` hoy es un tipo inline: pasa a usar `geographySchema` para no duplicar reglas.

El API valida longitud, no pertenencia a una lista. La lista de países es una decisión de UI y no debe bloquear integraciones futuras ni obligar a un deploy del backend para agregar un país.

### 3. País como lista estática en el dashboard

`apps/dashboard/src/lib/countries.ts`:

```ts
export const COUNTRIES = ['Argentina', 'Bolivia', /* ... */ 'Colombia' /* ... */] as const;
export const DEFAULT_COUNTRY = 'Colombia';
```

Se guarda el nombre visible (`country = 'Colombia'`), no el código ISO. Trade-off explícito: es suficiente para el MVP y para mostrar en pantalla; si más adelante hace falta i18n, filtros por código o integración con un servicio de facturación, se agrega `country_code char(2)` con lookup y se backfillea desde el nombre. Guardar el nombre hoy evita una tabla de catálogo que nadie pidió.

En altas nuevas el select arranca en `DEFAULT_COUNTRY`; en edición muestra el valor guardado o vacío si es `null`. El usuario puede limpiar el campo (queda `null`), y la UI lo muestra como “—”.

### 4. `PATCH /api/platform/organizations/:id` con transferencia de administrador

Contrato:

```ts
{
  name?: string;
  slug?: string;
  administratorEmail?: string;
}
```

Respuesta:

```ts
{
  organization: { id, name, slug, /* ... */ };
  administrator:
    | { status: 'active'; userId: string; email: string; name: string }
    | { status: 'pending'; email: string; invitationId: string; acceptUrl: string }
    | null;
}
```

Algoritmo, en una transacción:

1. Cargar la organización; `404` si no existe.
2. Si vienen `name`/`slug`, actualizar como hoy, resolviendo el slug con `slugService.uniqueOrganizationSlug`. El nombre no regenera el slug.
3. Si `administratorEmail` viene y normalizado (trim + lowercase) es igual al email del administrador activo, no se hace transferencia.
4. Si viene y es distinto:
   - **El email existe en `users`**: se busca la membresía `org_admin` de esa organización para ese usuario (sin `communityId`, `unitId` ni `locationUnitId`). Si existe, se reactiva (`status = 'active'`); si no, se inserta. Luego se desactivan las demás membresías `org_admin` activas de esa organización. Se revocan las invitaciones `org_admin` pendientes de esa organización.
   - **El email no existe**: se revoca cualquier invitación `org_admin` pendiente de la organización y se crea una nueva con `createInvitation`. El administrador actual **no** se desactiva.
5. Auditar `organization.updated` cuando cambia el nombre y `organization.administrator_changed` cuando cambia el administrador, con `{ from, to, pending }`.

Punto crítico: `memberships_unique_idx` incluye `community_id`, `unit_id` y `location_unit_id`, que en una membresía `org_admin` son `NULL`. En PostgreSQL los `NULL` se consideran distintos en un índice único, así que `onConflictDoNothing` **no** deduplica. La membresía se resuelve con un `SELECT` explícito y luego insert o update; nunca con un upsert ciego.

### 5. La aceptación de la invitación cierra la transferencia

Cuando se acepta una invitación `org_admin`, `acceptInvitation` debe desactivar las demás membresías `org_admin` activas de esa organización, dentro de la misma transacción y excluyendo la recién creada. Aplica a las dos ramas: usuario existente y usuario nuevo.

Sin esto, la política de "el actual sigue activo hasta que se acepte" dejaría dos administradores activos para siempre.

### 6. UI: un solo diálogo de edición

En la tabla de Organizaciones, la celda **Acciones** pasa a tener **Editar**. Abre un `FormDialog` con:

- **Nombre de la organización** (obligatorio, `max 255`).
- **Administrador**: línea de solo lectura con el nombre y email actuales, o “Administrador pendiente: email” cuando hay invitación pendiente.
- **Nuevo administrador (email)**: opcional. Si queda vacío, solo se cambia el nombre.

Los datos iniciales salen de `GET /api/platform/organizations/:id/overview`, que ya devuelve `administrator` y `pendingAdministrator`. Si la respuesta trae `acceptUrl` (transferencia pendiente), el diálogo muestra el link una vez con botón de copiar, igual que el resto de las invitaciones.

El slug no se edita en este diálogo. Se muestra como texto de solo lectura para que el platform admin sepa qué identificador queda.

### 7. Geografía en los detalles

Los tres campos se muestran con `DetailField` en:

- Detalle de organización de `/platform` (agregar al `select` de `GET /organizations/:id/overview`).
- Detalle de comunidad de `/admin`.
- Resumen de Mi Organización (`GET /api/organizations/me` ya devuelve la fila completa).

`GET /api/communities/:id/overview` usa `db.select().from(communities)`, así que las columnas nuevas viajan solas; solo hay que renderizarlas.

## Migration plan

1. `pnpm --filter @porteria/database db:generate` y revisar el SQL generado.
2. Confirmar que las columnas son nullable y que no hay `DEFAULT`.
3. Aplicar en local y correr la suite de integración de API.
4. Verificar que `GET /api/organizations/me`, `GET /api/platform/organizations/:id/overview` y `GET /api/communities/:id/overview` devuelven los campos nuevos.
5. Backup antes de aplicar en staging y producción.

## Risks

- **Doble `org_admin` activo**: si la aceptación de la invitación no desactiva al anterior, quedan dos administradores. Cubierto por el paso 5 y por un test de integración.
- **Membresía duplicada por `NULL` en el índice único**: cubierto por el `SELECT` explícito del paso 4.
- **Organización sin administrador**: la transferencia a un email nuevo mantiene al actual activo; si la invitación expira, el estado queda igual que antes.
- **Nombre duplicado**: `organizations.name` es `unique`; el API devuelve `409` y el diálogo muestra el error sin cerrar.
- **País escrito a mano en datos viejos**: al no haber backfill, algunos registros muestran “—” hasta que se editen. Es aceptable y visible.
- **Migración irreversible en la práctica**: `DROP COLUMN` borra lo cargado. Backup obligatorio.
