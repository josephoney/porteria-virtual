## Context

`add-dynamic-qr-access` fue especificado antes de la jerarquía de ubicaciones y del
modelo persona/cuenta/subusuarios. El change sigue siendo la fuente de verdad del flujo
QR, pero sus referencias deben alinearse con las nuevas entidades. No se duplica el flujo:
se actualiza el change existente y se define el contrato de integración.

## Goals / Non-Goals

**Goals:**

- Que cada pase apunte a una ubicación hoja válida.
- Que el autorizador quede trazado (principal o subusuario).
- Que las notificaciones lleguen a los residentes correctos.
- Migrar pases existentes sin romper el flujo.
- Documentar impactos antes de implementar.

**Non-Goals:**

- No se redefine el QR rotativo ni el scanner.
- No se cambia el modelo de subusuarios.
- No se crea un change QR nuevo.

## Decisions

### 1. `location_unit_id` como referencia

**Decisión:** `access_passes.unit_id` se reemplaza por `location_unit_id`, que apunta a
un nodo hoja (`level_position = level_count`). Se conserva `community_id` y se agrega
`structure_id` denormalizado.

**Alternativas:** mantener `unit_id` y agregar una tabla puente. Se descarta: duplica la
referencia.

### 2. Autorizador explícito

**Decisión:** el pase guarda:
- `created_by_person_id`: quien creó el pase (principal o subusuario);
- `authorized_by_person_id`: quien autoriza (puede ser el mismo);
- `authorized_by_delegation_id`: si es subusuario.

**Alternativas:** solo `created_by` usuario. Se descarta: no traza subusuarios.

### 3. Validación de creación

**Decisión:** al crear un pase:
- la ubicación debe ser hoja y pertenecer a la comunidad;
- el creador debe ser residente/ocupante de la ubicación o un subusuario con
  `authorize_visitors` y alcance;
- la comunidad debe pertenecer a la organización del token;
- el autorizador debe tener permiso vigente.

### 4. Escaneo y bitácora

**Decisión:** el scan devuelve:
- estructura/niveles y unidad (ruta legible);
- nombre/apellido del visitante;
- autorizador (principal/subusuario);
- placa si hay vehículo.

La bitácora guarda snapshots y IDs.

### 5. Notificaciones

**Decisión:** destinatarios:
- principal(es) y residentes de la ubicación con cuenta;
- subusuario autorizador;
- guardia/community_admin en salida faltante.

Se resuelven desde `location_residents` + `accounts`.

### 6. Migración

**Decisión:** mapear cada `access_passes.unit_id` legacy a `location_unit_id` usando el
mapa de migración de la propuesta 4. Los pases sin mapeo quedan en cuarentena y se
reportan.

### 7. Compatibilidad

**Decisión:** durante la transición, la API acepta `unitId` y lo normaliza a
`locationUnitId`; el DTO nuevo expone `locationUnitId`. Se elimina el alias al finalizar
la migración.

### 8. Actualización del change activo

**Decisión:** este change no crea specs duplicadas del QR; define el contrato de
integración y las tareas para actualizar `add-dynamic-qr-access` (proposal/design/specs/
tasks) antes de implementarlo.

## Impactos por artefacto del QR

| Artefacto | Cambio |
|---|---|
| `proposal.md` | referencias a `locationUnitId`, persona/subusuario |
| `design.md` | modelo, validaciones, notificaciones |
| `dynamic-pass-creation/spec.md` | ubicación hoja y autorizador |
| `pass-scan-entry/spec.md` | ruta de ubicación y autorizador |
| `pass-lifecycle/spec.md` | notificaciones por residentes |
| `database-schema/spec.md` | columnas/FKs |
| `shared-types/spec.md` | DTOs |
| `tasks.md` | migración y tests |

## Risks / Trade-offs

- **[Riesgo] Pases sin ubicación mapeada** → Mitigación: cuarentena + reporte.
- **[Riesgo] Duplicar el change QR** → Mitigación: actualización en sitio.
- **[Riesgo] Autorizador revocado** → Mitigación: validar al crear; los pases usados
  quedan.
- **[Trade-off] Alias temporal `unitId`** → Se elimina al final.

## Open Questions

- ¿Un pase puede autorizar una ubicación con varios residentes? Propuesta: sí; el
  autorizador debe ser uno de ellos o un subusuario con permiso.
- ¿Se migran pases históricos o solo activos? Propuesta: activos + históricos si el
  mapeo es posible.
