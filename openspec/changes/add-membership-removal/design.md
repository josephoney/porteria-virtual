## Context

`PATCH /api/memberships/:id { status: 'inactive' }` es la única salida: la fila queda en
la base con `status = 'inactive'`. El spec `user-management` dice explícitamente que la
membresía "se puede desactivar sin borrar el usuario", y el frontend llama a esa acción
"Quitar asignación", lo que sugiere un borrado que en realidad no ocurre.

Verificado en el esquema: **ninguna tabla referencia `memberships.id`**. Las relaciones
de historial cuelgan de `people` (bitácora, pases, turnos), así que borrar la membresía no
rompe trazabilidad ni deja huérfanos.

La tabla de Usuarios muestra hoy hasta cinco iconos dentro de la celda de membresía, en
una fila que se desborda cuando la persona tiene dos o más asignaciones.

## Goals / Non-Goals

**Goals:**

- Poder eliminar una asignación de forma definitiva, con las mismas reglas de alcance y
  de rol que ya rigen crearla o editarla.
- Evitar los estados peligrosos: dejar una organización sin administrador, borrarse el
  propio contexto de trabajo o eliminar una asignación con turno abierto.
- Que la interfaz haga evidente la diferencia entre inactivar y eliminar.
- Ordenar los iconos en una columna propia, con un orden fijo.

**Non-Goals:**

- Borrado masivo, ni desde la consola de plataforma.
- Borrar la persona o la cuenta.
- Cambiar el comportamiento de la baja lógica.
- Historial de asignaciones eliminadas más allá del evento de auditoría.

## Decisions

### 1. Borrado físico, no una tercera columna de estado

**Decisión:** `DELETE` elimina la fila.

**Por qué:** el estado ya tiene dos valores (`active`, `inactive`) y la baja lógica cubre
el caso temporal. Una tercera marca "deleted" obligaría a filtrar en cada consulta de
membresías —login, contexto, RBAC, listados— y a migrar datos, sin aportar nada: la
auditoría conserva el rastro de quién borró qué.

**Alternativa descartada:** `deleted_at` con filtros globales. Más caro y más fácil de
olvidar en una consulta nueva.

### 2. Las guardas van en el servicio, no en la ruta

**Decisión:** `deleteMembership` concentra alcance, política de rol, último `org_admin`,
contexto propio y turno abierto; la ruta solo traduce códigos a HTTP.

**Por qué:** la creación y la edición ya centralizan sus reglas así; una ruta con lógica
propia se desincroniza en la siguiente iteración.

**Guardas, en orden:**

1. platform admin → `tenant_read_only` (los guardarraíles de tenant siguen vigentes).
2. rol del actor sin permiso de gestión → `forbidden`.
3. membresía inexistente o fuera de alcance → `not_found`.
4. rol de la membresía que el actor no puede asignar → `role_out_of_scope`.
5. es la última membresía `org_admin` activa de la organización → `last_org_admin`.
6. es la membresía del propio contexto activo del actor → `own_active_membership`.
7. la persona tiene un turno abierto en esa comunidad → `open_shift`.

### 3. `200 { deleted: true }` en lugar de `204`

**Decisión:** respuesta con cuerpo.

**Por qué:** el cliente necesita distinguir "se borró" de "no había nada" para refrescar
y avisar; con `204` el `apiClient` no tiene nada que leer y el mensaje queda genérico.

### 4. Inactivar y eliminar coexisten, con nombres distintos

**Decisión:** la acción existente se rotula "Inactivar asignación" / "Reactivar
asignación" y se agrega "Eliminar asignación" (destructiva, con confirmación).

**Por qué:** "Quitar asignación" describía un borrado que no ocurría. Ahora cada botón
dice lo que hace, y eliminar exige confirmación explícita.

### 5. Columna Acciones después de Membresía

**Decisión:** nueva columna con iconos apilados en orden fijo: agregar, cambiar
contraseña, reenviar activación, puesto por defecto (solo guardias), inactivar/reactivar
y eliminar al final. La celda de Membresía conserva el selector de rol y las insignias.

**Por qué:** separa "qué es esta asignación" de "qué puedo hacer con ella", y el
apilado vertical mantiene alineados los botones aunque la persona tenga varias filas.

## Risks / Trade-offs

- **[Riesgo] Un admin se borra su propio contexto y pierde acceso** → guarda
  `own_active_membership`; igual puede pedir a otro admin.
- **[Riesgo] Organización sin administrador** → guarda `last_org_admin` solo para la
  última membresía activa; con dos, se permite.
- **[Riesgo] Turno abierto sin guardia** → guarda `open_shift`; el admin puede forzar el
  cierre y reintentar.
- **[Trade-off] El borrado no se puede deshacer** → la confirmación muestra persona, rol
  y comunidad, y la auditoría registra el evento; para recuperar hay que recrear.
- **[Riesgo] Historial huérfano** → mitigado porque la bitácora y los pases referencian
  `person_id`, no la membresía.
- **[Trade-off] `roles` fuera de alcance no se pueden borrar** → intencional: si no
  pudiste crear ese rol, no deberías poder destruirlo.

## Migration Plan

1. **API primero** (aditivo): `DELETE` nuevo; nada existente cambia.
2. **Dashboard después**: columna Acciones y acción de borrado.
3. **Rollback**: quitar la UI y la ruta; las filas ya borradas no se recuperan, pero no
   hay migración que revertir.
4. **Sin feature flag** ni paso de runbook.
