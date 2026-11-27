## Why

Hoy la única forma de sacar una asignación es inactivarla. Un usuario con dos
asignaciones del mismo perfil queda con una fila inactiva que no se puede limpiar, y el
administrador no tiene manera de cerrar el ciclo: el registro sigue ocupando espacio y
apareciendo en el listado para siempre.

Al mismo tiempo, los iconos de acciones de la tabla de Usuarios viven dentro de la celda
de membresía y se acomodan en una fila que crece sin orden, lo que hace difícil saber qué
botón corresponde a qué asignación cuando una persona tiene varias.

## What Changes

- Nuevo `DELETE /api/memberships/:id` que **elimina** la asignación (borrado real), con
  guardas de alcance, política de rol y consistencia operativa.
- La baja lógica se conserva: **inactivar** sigue siendo temporal y **eliminar** es
  definitivo. La interfaz distingue las dos acciones.
- Auditoría `membership.deleted` con persona, rol y comunidad.
- Columna **Acciones** en la tabla de Usuarios, después de Membresía, con los iconos en
  orden vertical estable. La celda de Membresía queda informativa: rol e insignias.
- Nueva acción **Eliminar asignación** con confirmación explícita.

**Non-goals:**

- Borrar personas o cuentas: el usuario y su historial se conservan; solo se retira la
  asignación.
- Borrado en lote o desde la consola de plataforma (sigue siendo read-only sobre tenant).
- Cambiar el significado de "inactivar": no se migra ninguna membresía inactiva.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `user-management`: se agrega el borrado definitivo de una membresía y sus guardas.
- `dashboard-admin`: la tabla de Usuarios suma la columna Acciones y reorganiza sus
  iconos.

## Impact

- **API**: `memberships.service.ts` (nuevo `deleteMembership`), `memberships.routes.ts`
  (`DELETE /:id`), auditoría con `insertEvent`.
- **Dashboard**: `UsersTable.tsx` (columna, iconos, diálogo de confirmación).
- **Documentación**: `docs/api-v1-contract.md` y `docs/roles-y-permisos.md`.
- **Pruebas**: integración del borrado y de sus guardas.
- **Base de datos**: sin migración; nada referencia `memberships.id`, así que el borrado
  no arrastra historial.
