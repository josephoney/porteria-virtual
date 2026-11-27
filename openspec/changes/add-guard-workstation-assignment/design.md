## Context

El modelo ya tiene el lugar donde vive el puesto: `memberships.default_access_point_id`
(uuid, FK a `access_points` con `on delete set null`, indexado por
`memberships_default_access_point_idx`). Lo escriben y leen piezas sueltas:

- `GuardPanel` lo lee desde la sesión (`activeMembership.defaultAccessPointId`) y lo usa
  para preseleccionar el acceso al iniciar turno;
- `createMembership` / `updateMembership` lo aceptan en el body y lo validan contra la
  comunidad (`validateDefaultAccessPoint`);
- `guard-shifts` ya especifica el comportamiento de "acceso por defecto" y la regla de
  "default out of scope".

Lo que falta es el contrato y la superficie: no hay endpoint que exprese "asignar el
puesto", no se valida el rol, no se audita, y no existe lectura de "quién está asignado a
esta portería". El dashboard nunca tuvo el campo, aunque el spec `guard-dashboard` y
`docs/onboarding-comunidad.md` lo prometen.

Restricciones que condicionan el diseño:

- Una membresía = una comunidad, y ya existe un puesto por membresía. Un guardia en dos
  comunidades tiene dos membresías y dos puestos.
- El turno es del guardia: solo él cambia de acceso durante un turno
  (`/shifts/:id/change-access-point`); el admin solo puede forzar el cierre.
- La bitácora congela el nombre del acceso, así que mover un turno desde administración
  escribiría entradas que el guardia no hizo.

## Goals / Non-Goals

**Goals:**

- Un contrato único para asignar, desasignar y leer el puesto de trabajo.
- Reglas explícitas y verificables: rol `guard`, comunidad de la membresía, acceso activo
  de esa comunidad.
- Auditoría de cada cambio con puesto anterior y nuevo.
- Pantallas mínimas para que el admin asigne sin curl: Usuarios (acción) y Accesos (quién
  está asignado).
- Estado claro para el guardia cuando no tiene puesto o su puesto está inactivo.

**Non-Goals:**

- Varios puestos por membresía.
- Horarios, rotación o calendario de puestos.
- Restringir en qué accesos puede escanear o iniciar turno un guardia: la asignación es
  informativa y los grants por persona/acceso siguen en Phase 2 de
  `add-guard-shifts-and-access-bitacora`.
- Mover un turno abierto desde administración.
- Notificar el cambio (depende de `add-notification-service`).

## Decisions

### 1. Recurso `workstation` dedicado, con un solo servicio detrás

**Decisión:** `PUT /api/memberships/:id/workstation` y `GET /api/me/workstation`, más
`GET /api/communities/:id/access-points/:accessPointId/guards`. Toda la lógica vive en
`workstation.service.ts`.

**Por qué:** la asignación tiene reglas propias que `PATCH /api/memberships/:id` no
expresa (rol, acceso activo, no mover turnos) y necesita su propio evento de auditoría.
Un recurso con nombre también documenta el flujo.

**Compatibilidad:** `PATCH /api/memberships/:id` sigue aceptando `defaultAccessPointId`,
pero delega en el mismo servicio. No se rompe ningún cliente ni el onboarding escrito.

**Alternativa descartada:** seguir usando solo `PATCH /memberships` y validar ahí. Deja el
contrato sin nombre, mezcla rol/estado/alcance con puesto y obliga a duplicar reglas en la
UI.

### 2. Un puesto por membresía (columna existente), no tabla nueva

**Decisión:** se usa `memberships.default_access_point_id`.

**Por qué:** ya existe, ya está indexada, ya la consumen turnos y la app, y el producto
real asigna una portería por guardia y comunidad. Una tabla `guard_workstations` 1:N
obligaría a migración, backfill y a redefinir el "default" de los turnos.

**Consecuencia:** el caso "cubre dos porterías" se resuelve con el cambio de acceso
durante el turno, que ya existe.

### 3. Solo membresías con rol `guard`

**Decisión:** cualquier otro rol → `400 role_not_guard`. La membresía sin comunidad →
`400 membership_requires_community`.

**Por qué:** el operador monitorea y no inicia turno; los administradores y residentes no
tienen puesto físico. Hoy la API acepta el campo para cualquier rol, lo que permite datos
sin sentido.

**Alternativa descartada:** permitir `operator` para "central de monitoreo". No hay turno
de operador en el modelo, así que el campo quedaría muerto.

**Alcance del actor:** asignan `org_admin` (su organización) y `community_admin` (su
comunidad), los mismos roles que ya gestionan accesos. Un platform admin **no** asigna:
los guardarraíles de tenant read-only le bloquean toda escritura de tenant con `403`.

### 4. Cambiar el puesto no mueve un turno abierto

**Decisión:** si el guardia tiene turno abierto, la asignación se guarda y la respuesta
incluye `activeShiftAccessPointId` y `appliesNextShift: true`. El turno actual no se toca.

**Por qué:** el turno pertenece al guardia y cada movimiento escribe bitácora. Moverlo
desde administración atribuiría al guardia una acción que no hizo y rompería la regla de
`guard-shifts`.

**Alternativa descartada:** reasignar el turno automáticamente. Genera dos entradas de
bitácora sin actor real y deja el turno fuera de control del guardia.

### 5. La asignación es informativa, no una autorización

**Decisión:** el puesto es el valor por defecto y el criterio de visibilidad para el
administrador. El guardia puede iniciar turno en cualquier acceso activo de su comunidad,
esté o no asignado.

**Por qué:** en la operación real un guardia cubre una portería ajena por reemplazo o
emergencia; bloquearlo obligaría a un admin a habilitarlo en el momento. Además el change
archivado de turnos dejó los grants por persona/acceso explícitamente en Phase 2, y
adelantarlos aquí convertiría una mejora de visibilidad en un cambio de comportamiento
operativo.

**Alternativa descartada:** rechazar el inicio de turno fuera del puesto asignado. Da una
asignación "real", pero introduce un modo de fallo durante el turno y exige una tabla de
excepciones para el reemplazo.

**Consecuencia:** la interfaz debe decir "puesto por defecto", nunca "puesto autorizado",
para no prometer una restricción que no existe.

### 6. Desasignar es `accessPointId: null` e idempotente

**Decisión:** `PUT` con `null` limpia la columna y responde `200` con
`{ accessPointId: null }`. Repetirlo devuelve lo mismo, sin error.

**Por qué:** la UI necesita "Sin asignar" y un `PUT` idempotente evita distinguir entre
"nunca asignado" y "desasignado" en el cliente.

### 7. Lectura de asignados separada de la de turnos activos

**Decisión:** `GET /api/communities/:id/access-points/:accessPointId/guards` devuelve los
guardias **asignados** (con `onShift` y `shiftId` si además tienen turno abierto).

**Por qué:** `GET /api/guard/active-guards` responde "quién está ahora" y no "quién
debería estar". Son preguntas distintas y el admin necesita ambas; mezclarlas en un
parámetro booleano hace que el nombre del endpoint mienta.

### 8. `GET /api/me/workstation`, no confiar en el token

**Decisión:** el panel del guardia lee su puesto de este endpoint al montar y después de
iniciar/cerrar turno.

**Por qué:** `defaultAccessPointId` viaja en la sesión, pero una asignación hecha por el
admin no se refleja hasta el siguiente refresh (hasta 15 min). El endpoint dedicado da el
nombre, el tipo, la dirección y el estado del acceso, que el panel necesita para avisar
"tu puesto está inactivo".

**Alternativa descartada:** ampliar `GET /api/me`. Ya devuelve `defaultAccessPointId` pero
no los datos del acceso; añadirlos engorda un endpoint que usan todos los roles.

### 9. Auditoría con el patrón existente

**Decisión:** `insertEvent` con `eventType` `admin.workstation.assigned` /
`admin.workstation.unassigned`, `communityId` de la membresía y metadata
`{ membershipId, personId, previousAccessPointId, accessPointId }`.

**Por qué:** cumple el requisito de auditoría de `admin-hierarchy` sin inventar tablas y
queda visible en la página de Auditoría.

### 10. La desactivación de un acceso conserva la asignación

**Decisión:** desactivar un acceso no limpia `default_access_point_id`. El listado marca
el puesto como inactivo, el selector solo ofrece activos y el inicio de turno sigue
exigiendo un acceso activo (regla ya vigente).

**Por qué:** un toggle de estado no debe borrar información; la asignación vuelve a ser
útil si el acceso se reactiva. La FK `on delete set null` cubre el borrado real.

### 11. Interfaz: una acción, dos lecturas y un estado vacío

**Decisión:**

- `UsersTable`: acción de fila "Puesto de trabajo" en la celda de la membresía, solo para
  `role === 'guard'` y solo si el rol es asignable por quien mira. Abre un diálogo con
  select de accesos activos de la comunidad de esa membresía + "Sin asignar". Si hay turno
  abierto, muestra el aviso y el puesto actual del turno.
- `AccessPointsPanel`: columna con el conteo de guardias asignados (viene en el listado de
  accesos, para no hacer N llamadas) y un detalle con nombre, estado del turno y acción
  "Asignar" que abre el mismo diálogo.
- `GuardPanel`: chip con el puesto asignado; si no hay, "Sin puesto asignado" con CTA; si
  está inactivo, aviso y sugerencia de elegir otro al iniciar turno.

**Por qué:** cubre las dos preguntas del administrador (¿este guardia dónde va? y ¿esta
portería quién la cubre?) con un solo componente de asignación.

## Risks / Trade-offs

- **[Riesgo] Dos caminos de escritura divergen** (`PUT workstation` y `PATCH membership`)
  → Mitigación: un único servicio; `PATCH` delega y no reimplementa validaciones.
- **[Riesgo] El puesto del token queda viejo hasta 15 min** → Mitigación: el panel usa
  `GET /api/me/workstation`; la sesión solo se usa como valor inicial.
- **[Riesgo] Un `community_admin` asigna a un guardia de otra comunidad** → Mitigación:
  alcance por comunidad en el servicio y `404` para recursos ajenos (no se filtra
  existencia).
- **[Riesgo] N+1 al listar guardias por acceso** → Mitigación: un join de `memberships` +
  `people` + `accounts` + turno abierto en una sola consulta.
- **[Trade-off] No hay historial de asignaciones** más allá de los eventos → se
  reconstruye desde la Auditoría; una tabla de historial no se justifica con un campo
  único.
- **[Trade-off] El diálogo necesita los accesos de la comunidad** → una llamada por
  apertura, cacheada por comunidad en el cliente.
- **[Riesgo] Asignación huérfana si se borra el acceso** → la FK `on delete set null`
  limpia la columna; el listado nunca muestra un id inexistente.
- **[Riesgo] Un admin cree que la asignación restringe el turno** → Mitigación: la interfaz
  dice "puesto por defecto", el spec lo declara informativo y un escenario de integración
  verifica que un guardia inicia turno fuera de su puesto.

## Migration Plan

1. **API primero** (aditivo): servicio, rutas, schemas y auditoría. `PATCH` sigue
   funcionando; nadie queda bloqueado.
2. **Dashboard después**: acción en Usuarios, detalle en Accesos y chip en el panel del
   guardia.
3. **Documentación**: corregir `docs/onboarding-comunidad.md` para que describa la acción
   real en lugar del campo inexistente.
4. **Rollback**: quitar la acción de la UI y los endpoints; la columna y sus datos no se
   tocan, así que el rollback no pierde asignaciones. Sin migración, sin downtime.
5. **Sin feature flag**: el cambio es aditivo y no altera turnos existentes.

## Open Questions

- ¿El cambio de puesto debe notificar al guardia? Queda para cuando exista
  `add-notification-service`; hoy el panel lo muestra al montar.
- ¿La app Zima debe mostrar el puesto asignado? Consumirá `GET /api/me/workstation` en un
  change posterior; no se incluye aquí para no acoplar este cambio a un build de la app.
