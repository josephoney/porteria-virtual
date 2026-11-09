## Context

La base multi-tenant y el outbox están archivados. El dashboard legacy y el signaling
siguen usando un modelo donde la confianza está en el cliente. Los hallazgos P0/P1 se
verificaron con usuarios demo y con una prueba real de escalada de roles.

## Goals / Non-Goals

**Goals:**

- Cerrar el acceso no autorizado al signaling y la actuación de puertas/relés.
- Aislar operadores, kiosks y llamadas por comunidad.
- Eliminar los 500 del superadmin y la escalada `community_admin → org_admin`.
- Evitar que residentes usen el panel de operador.
- Resolver la identidad ambigua de kiosks y limpiar la data legacy.

**Non-Goals:**

- No se rediseña el flujo QR dinámico.
- No se implementa la nueva jerarquía de ubicaciones ni personas/subusuarios.
- No se reemplaza el dashboard por completo.

## Decisions

### 1. JWT en el handshake de Socket.io

**Decisión:** el cliente envía `auth: { token }` al conectar. El signaling verifica el
JWT con el mismo secreto, extrae `sub`, `role`, `orgId`, `communityId` y `membershipId`,
y rechaza conexiones inválidas o sin token.

**Alternativas:** seguir confiando en `operator:register` con `operatorId`/`communityId`.
Se descarta: es spoofeable.

### 2. Operadores en rooms por comunidad

**Decisión:** cada operador autenticado se une a la room de su alcance:
`community:{communityId}` para `operator`, `guard` y `community_admin`, y
`org:{orgId}` para `org_admin`. Los eventos de kiosks/llamadas se emiten a la room
correspondiente, no a todos los operadores.

**Alternativas:** filtrar en el cliente. Se descarta: el dato ya viajó.

### 3. Autorización de actuación

**Decisión:** `door:open` y `relay:trigger` validan:
- rol operativo (`operator`, `guard`, `community_admin`, `org_admin`);
- que el kiosk pertenezca a la comunidad del token;
- que el operador esté asociado a esa comunidad (o sea org_admin de la org).

**Alternativas:** validar solo en el frontend. Se descarta.

### 4. Kiosk autenticado

**Decisión:** el kiosk se registra con un token de dispositivo emitido por el API
(provisioning). El signaling valida ese token y deriva `kioskId`, `communityId` y
`organizationId`; no acepta `communityId` del payload.

**Alternativas:** mantener el registro abierto. Se descarta.

### 5. Contexto de plataforma aislado

**Decisión:** si el token es de plataforma (`membershipId = 'platform'`):
- `/api/platform/*` funciona;
- los endpoints de tenant responden 403 con un mensaje “seleccioná una comunidad”;
- el dashboard oculta Operador/Admin/Guardia y muestra `/platform` como home.

**Alternativas:** devolver 200 vacío. Se descarta porque oculta el error de configuración.

### 6. Política central de asignación de roles

**Decisión:** una función `canAssignRole(requester, role, scope)`:
- solo platform admin crea `org_admin`;
- org_admin crea roles dentro de su organización (incluido community_admin);
- community_admin crea roles dentro de su comunidad, sin `org_admin`;
- nadie se autoasigna un rol superior.

Se usa en `users.service` y `memberships.service`, y se refleja en la UI.

### 7. Ruteo del dashboard por rol

**Decisión:** `/` requiere rol operativo (`operator`, `community_admin`, `org_admin`,
platform). El residente va a `/app-required` o a la app Zima. El `SocketContext` solo
registra operador si el rol activo es operativo.

### 8. Identidad de kiosk

**Decisión:** `rpi_id` único globalmente o, si se mantiene por comunidad, el resolve
exige `communityId + rpiId`. La migración detecta duplicados y renombra el legacy
(`edificio-01-legacy`) o elimina la organización legacy sin memberships.

### 9. Alcance de llamadas

**Decisión:** en `listCalls`, solo `operator` fuerza `operatorId = self`;
`community_admin` filtra por su comunidad; `org_admin` por su organización; platform no
accede a llamadas de tenant.

## Data / Migration

1. Agregar token de dispositivo a kiosks (si no existe) y endpoint de provisioning.
2. Detectar `rpi_id` duplicados; renombrar/eliminar legacy.
3. Dejar la organización legacy sin memberships aislada; la eliminación/migración de
   sus llamadas huérfanas queda como follow-up con backup y ventana de mantenimiento.
4. Ajustar políticas de rol en servicios.
5. Cambiar rooms/eventos de signaling.
6. Agregar guard de `/` y del socket.

## Risks / Trade-offs

- **[Riesgo] Romper el kiosk actual** → Mitigación: provisioning compatible y flag.
- **[Riesgo] Perder llamadas legacy** → Mitigación: backup y confirmación antes de
  borrar; alternativa de migrarlas.
- **[Trade-off] JWT en sockets** → Más setup, pero cierra el P0.
- **[Riesgo] Platform admin sin contexto** → Mitigación: mensaje claro y `/platform`.

## Open Questions

- ¿Se conservan las 97 llamadas legacy migrándolas a Torre Norte o se descartan?
  Propuesta: descartarlas en dev, migrarlas en producción si existen.
- ¿El kiosk tendrá token de dispositivo o seguirá usando `rpiId` + community? Propuesta:
  token de dispositivo.
