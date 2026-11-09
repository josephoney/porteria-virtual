## Why

Hoy el acceso físico está atado al kiosco y al relé: `access_codes` existe sin servicio
ni rutas, la apertura se hace por un endpoint interno de relés y no hay una evaluación
central de permisos. Eso impide sumar QR, PIN, RFID, biometría, vehículos o hardware de
terceros sin duplicar lógica. Se necesita un **motor de control de acceso** único que
evalúe credenciales contra reglas, actué y audite siempre.

## What Changes

- Crear un modelo de **credenciales** (`credentials`) para QR, PIN, RFID, biometría y
  patente, con ciclo de vida (emisión, revocación, expiración, usos).
- Crear un modelo de **reglas de acceso** (`access_rules`) con alcance por sujeto,
  punto de acceso, horario, vigencia, dirección, usos máximos y anti-passback.
- Crear un **motor de decisión** determinista con endpoint interno
  `POST /api/internal/access/verify`.
- Persistir **`access_logs`** append-only y emitir eventos `access.granted` /
  `access.denied` / `access.actuation_failed`.
- Definir la **política por punto de acceso** (`fail_open` / `fail_closed`, dirección).
- Exponer un **snapshot de política firmado** y un delta de revocaciones para que los
  dispositivos decidan offline.
- Introducir una **costura de actuación** (`Actuator`) que en Fase 1 usa el control de
  relés existente y en `add-device-abstraction` se reemplaza por comandos genéricos.
- **Non-goals:** no se implementa la emisión de pases QR desde la app residente
  (`add-qr-access-passes`), ni enrolamiento biométrico (`add-biometric-access`), ni la
  abstracción completa de dispositivos (`add-device-abstraction`), ni gestión de
  visitas/paquetes.

## Capabilities

### New Capabilities

- `access-credentials`: modelo de credenciales, tipos, contrato de token QR firmado,
  ciclo de vida, hashing de PIN y normalización de RFID/patente.
- `access-rules`: modelo y evaluación de reglas (precedencia deny-wins, horarios,
  vigencia, usos máximos, anti-passback, política por punto de acceso).
- `access-decision-engine`: endpoint de verificación, resultados de decisión,
  idempotencia, autenticación de dispositivos y actuación.
- `access-audit`: `access_logs` append-only y eventos de acceso.
- `access-offline-policy`: snapshot firmado de política, delta de revocaciones y
  decisión offline con cola de sincronización.

### Modified Capabilities

- `database-schema`: nuevas tablas `credentials`, `access_rules`, `access_logs`; nuevas
  columnas de política en `access_points`.
- `shared-types`: tipos y enums de credenciales, reglas, decisiones y auditoría.
- `relay-control`: la actuación acepta `requestId` idempotente y origen de acceso, y
  devuelve el resultado de la actuación.

## Impact

- **Database**: `packages/database/src/schema/*` (nuevas tablas, migración 0003).
- **API**: nuevo módulo `server/api/src/modules/access/*` (servicios, motor, rutas
  internas), schemas Zod y registro en `server/api/src/index.ts`.
- **Shared**: `packages/shared/src/types/access-*`, `enums`, `dto/access.ts`.
- **Signaling/Dispositivos**: llamadas al endpoint interno de verificación y snapshot
  de política; `relay-control` como actuador de Fase 1.
- **Dashboard**: configuración de puntos de acceso y reglas (mínimo en Fase 1).
- **Depende de**: `establish-domain-foundation` (community/unit/membership).
