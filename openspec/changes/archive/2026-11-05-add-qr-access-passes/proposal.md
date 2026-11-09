## Why

El motor de acceso ya define el contrato de un QR firmado, pero los residentes no
tienen forma de emitir pases para visitas, deliveries o proveedores. La tabla
`access_codes` existe sin servicio ni rutas. Sin emisión y validación de pases, el QR
queda como teoría y la portería sigue dependiendo de llamadas.

## What Changes

- Crear `access_passes`: pase de acceso con tipo, unidad, titular, vigencia, puntos de
  acceso, usos máximos y estado.
- Vincular cada pase a una **credencial QR** del motor de acceso (relación 1:1).
- Implementar **emisión** desde residente, guardia y administración, con reglas de
  alcance.
- Implementar **regeneración** de token sin cambiar el pase.
- Implementar **revocación** y expiración, con propagación al delta offline.
- Implementar **validación en escaneo** reutilizando el motor de decisión.
- Notificar al residente cuando la visita ingresa.
- Aplicar rate limits por unidad/día para evitar abuso.
- **Non-goals:** no se implementa el módulo completo de visitas ni paquetería, ni
  biometría, ni la UI de la app residente (queda para `add-resident-app`).

## Capabilities

### New Capabilities

- `qr-pass-issuance`: creación, alcance, token, regeneración y rate limits.
- `qr-scan-validation`: validación de escaneo, resultados y verificación offline.
- `pass-lifecycle`: vigencia, usos, revocación, listado y notificaciones de uso.

### Modified Capabilities

- `database-schema`: nueva tabla `access_passes` y relación con `credentials`.
- `shared-types`: tipos/enums de pases y DTOs de emisión/validación.

## Impact

- **Database**: `packages/database/src/schema/access-passes.ts`, migración.
- **API**: `server/api/src/modules/access/passes/*` (servicio, rutas, validación).
- **Shared**: tipos/DTOs de pases.
- **Dispositivos**: escaneo usa el endpoint de verificación del motor.
- **Depende de**: `establish-domain-foundation` y `add-access-control-engine`.
