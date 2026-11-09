## Why

La biometría facial es un diferencial del producto, pero también es el dato más
sensible y el que más riesgo de lock-in genera. No hay hardware elegido todavía, así
que el diseño debe ser **adapter-first**, funcionar con edge/on-prem/cloud, respetar el
consentimiento y operar offline. Hoy no existe enrolamiento, consentimiento, plantillas
ni verificación biométrica; este change los incorpora sobre el motor de acceso.

## What Changes

- Crear el modelo de **consentimiento biométrico** versionado y revocable.
- Crear el modelo de **plantillas biométricas** (`biometric_templates`) cifradas o por
  referencia de proveedor; nunca imágenes crudas por defecto.
- Implementar **enrolamiento** con consentimiento, liveness, control de calidad y
  detección de duplicados.
- Implementar **verificación 1:1 por defecto** y **1:N acotado por comunidad** como
  opción explícita, con umbral y límite de galería.
- Exigir **liveness** en toda verificación; rechazar si falla.
- Definir la interfaz **`BiometricProvider`** (`enroll`, `verify`, `identify`,
  `delete`, `health`) con adaptadores edge, on-prem y cloud.
- Soportar **caché de plantillas en el dispositivo** para verificación offline.
- Garantizar **fallback QR** y borrado/exportación de datos del titular.
- Auditar enrolamientos, verificaciones, revocaciones y accesos.
- **Non-goals:** no se compra hardware ni se elige proveedor; no se implementa el
  algoritmo de liveness ni el matching (los provee el adaptador); no se cubre
  reconocimiento de patentes (vehículos) en este change.

## Capabilities

### New Capabilities

- `biometric-enrollment`: consentimiento, captura, liveness, calidad, duplicados,
  creación y actualización de plantillas.
- `biometric-verification`: verificación 1:1, identificación 1:N acotada, umbrales,
  liveness, fallback QR y verificación offline.
- `biometric-provider-adapter`: interfaz de proveedor y adaptadores edge/on-prem/cloud.
- `biometric-privacy`: consentimiento versionado, derechos del titular, retención,
  borrado y auditoría.

### Modified Capabilities

- `database-schema`: nuevas tablas `biometric_consents` y `biometric_templates`, y
  referencia de plantilla en credenciales biométricas.
- `shared-types`: tipos/enums de biometría, consentimiento y resultados de verificación.

## Impact

- **Database**: `packages/database/src/schema/biometric-*.ts`, migración 0005.
- **API**: `server/api/src/modules/access/biometric/*` (servicio, adaptadores, rutas).
- **Shared**: tipos/DTOs de biometría.
- **Dispositivos**: adaptador edge o cliente del proveedor; caché de plantillas.
- **Dashboard**: enrolamiento y consentimiento; vista de auditoría biométrica.
- **Depende de**: `establish-domain-foundation` y `add-access-control-engine`.
