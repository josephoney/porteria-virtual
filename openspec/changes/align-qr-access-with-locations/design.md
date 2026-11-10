## Context

`add-dynamic-qr-access` fue especificado antes de la jerarquía de ubicaciones, del modelo
persona/cuenta y de los subusuarios. La parte de **ubicaciones y personas** ya se
implementó en el Slice 0 del MVP dentro de `add-dynamic-qr-access`: el pase usa
`location_unit_id`, `structure_id`, `created_by_person_id` y
`authorized_by_person_id`, y la bitácora muestra el camino de ubicación.

Este change queda para la **Phase 2**: integrar subusuarios/delegaciones y resolver
destinatarios de notificaciones. No se duplica el flujo QR.

## Goals / Non-Goals

**Goals (Phase 2):**

- Que un subusuario con `authorize_visitors` pueda crear pases en nombre del residente.
- Que el autorizador delegado quede trazado en el pase y en la bitácora.
- Que las notificaciones lleguen al residente principal y al autorizador si es distinto.

**Non-Goals:**

- No se redefine el QR rotativo ni el scanner.
- No se cambia el modelo de subusuarios.
- No se crea un change QR nuevo.
- No se migran datos: no existen pases en el MVP.

## Decisions

### 1. Parte A absorbida

**Decisión:** `location_unit_id`, `structure_id`, `created_by_person_id`,
`authorized_by_person_id`, la validación de hoja, el camino de ubicación y el preview con
`locationPath` ya están en `add-dynamic-qr-access`. Este change no los vuelve a definir.

**Alternativas:** mantener una copia acá. Se descarta: duplica la fuente de verdad.

### 2. Autorizador delegado (Phase 2)

**Decisión:** cuando exista `subuser_delegations`, el pase guarda:

- `created_by_person_id`: quien creó el pase (principal o subusuario);
- `authorized_by_person_id`: el residente principal o el subusuario que autoriza;
- `authorized_by_delegation_id`: la delegación activa, con FK a
  `subuser_delegations`.

En el MVP esta columna existe, es nullable y no tiene FK.

### 3. Validación de creación con delegación

**Decisión:** al crear un pase:

- la ubicación debe ser hoja y pertenecer a la comunidad;
- el creador debe ser residente/ocupante de la ubicación o un subusuario con
  `authorize_visitors` y alcance;
- la delegación debe estar activa;
- la comunidad debe pertenecer a la organización del token.

Sin delegación, el autorizador es el residente principal.

### 4. Escaneo y bitácora

**Decisión:** el scan devuelve:

- estructura/niveles y unidad (ruta legible);
- nombre/apellido del visitante;
- autorizador (principal/subusuario) y su relación;
- placa si hay vehículo.

La bitácora guarda snapshots y IDs, incluido `authorized_by_delegation_id` cuando
corresponda.

### 5. Notificaciones (Phase 2)

**Decisión:** destinatarios:

- principal(es) y residentes de la ubicación con cuenta;
- subusuario autorizador si es distinto;
- guardia/`community_admin` en salida faltante.

Se resuelven desde `location_residents` + `accounts`.

### 6. Sin migración de datos

**Decisión:** no hay pases legacy que migrar. El MVP crea el schema correcto desde el
día uno. Si en el futuro aparecen pases con `unit_id`, se resuelven con una migración
aparte.

### 7. Sin alias `unitId`

**Decisión:** el contrato nuevo usa solo `locationUnitId`. No se acepta `unitId` legacy
porque no hay clientes que lo usen.

### 8. Actualización del change activo

**Decisión:** este change no crea specs duplicadas del QR. Define el contrato de
integración de Phase 2 y las tareas para actualizar `add-dynamic-qr-access` cuando
`add-delegated-subusers` y `add-notification-service` estén listos.

## Impactos por artefacto del QR

| Artefacto                       | Cambio en Phase 2                          |
| ------------------------------- | ------------------------------------------ |
| `proposal.md`                   | autorizador delegado y dependencias        |
| `design.md`                     | validación con delegación y notificaciones |
| `dynamic-pass-creation/spec.md` | creación por subusuario                    |
| `pass-scan-entry/spec.md`       | autorizador delegado en scan/bitácora      |
| `pass-lifecycle/spec.md`        | notificaciones por residentes              |
| `database-schema/spec.md`       | FK de `authorized_by_delegation_id`        |
| `shared-types/spec.md`          | DTOs con autorizador delegado              |
| `tasks.md`                      | tareas de Phase 2 y tests                  |

## Risks / Trade-offs

- **[Riesgo] Delegación revocada** → Mitigación: validar al crear; los pases ya creados
  quedan con su snapshot.
- **[Riesgo] Duplicar el change QR** → Mitigación: actualización en sitio.
- **[Trade-off] Dependencia de dos changes en 0%** → Se implementa recién en Phase 2.

## Open Questions

- ¿Un pase puede autorizar una ubicación con varios residentes? Propuesta: sí; el
  autorizador debe ser uno de ellos o un subusuario con permiso.
- ¿Qué pasa si el subusuario pierde el permiso después de crear el pase? Propuesta: el
  pase sigue válido con el snapshot del autorizador; la revocación afecta solo pases
  nuevos.
