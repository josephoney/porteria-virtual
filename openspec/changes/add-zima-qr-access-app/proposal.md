## Why

El residente necesita crear y compartir pases desde el teléfono, y el guardia necesita
escanear el QR desde el mismo lugar. Hoy `apps/resident` es un stub PWA y no existe un
cliente móvil nativo. Se necesita una app Expo para Android/iOS que cubra ambos roles:
**Zima QR Access**.

## What Changes

- Crear `apps/zima-qr-access` (Expo + React Native + TypeScript).
- **Modo residente**:
  - login y selección de contexto/membresía;
  - crear pase: unidad, nombre, apellido, cédula, vehículo + placa, PIN opcional,
    tipo, fechas, días y horario;
  - mostrar el QR inicial dinámico;
  - compartir el link con el share sheet nativo;
  - historial, estado, revocar y regenerar link.
- **Modo guardia**:
  - login como guardia/operador;
  - escáner de QR con cámara;
  - resultado con nombre, apellido, cédula, placa, unidad y autorizador;
  - Confirmar/Rechazar;
  - historial de escaneos del turno.
- **Notificaciones**:
  - registrar token Expo Push;
  - listar notificaciones de ingreso, salida, rechazo y salida faltante;
  - deep link al pase o al escaneo.
- **Non-goals:** no reemplaza el dashboard admin/operador, no biometría, no pagos, no
  modo offline, no escaneo desde el dashboard.

## Capabilities

### New Capabilities

- `zima-mobile-auth`: login, contexto, almacenamiento seguro y refresh.
- `zima-pass-creation`: formulario de pase, vehículo, PIN y horarios.
- `zima-pass-sharing`: QR inicial, compartir link, historial, revocar/regenerar.
- `zima-guard-scan`: cámara, escaneo, confirmar/rechazar e historial.
- `zima-notifications`: registro de Expo Push, lista y deep links.

## Impact

- **Nueva app**: `apps/zima-qr-access` (Expo, pnpm workspace, Metro).
- **API**: consume los endpoints de `add-dynamic-qr-access` y
  `add-notification-service`.
- **Shared**: usa tipos/DTOs de `@porteria/shared`.
- **Config**: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ENV`, project id de Expo Push.
- **Depende de**: `add-dynamic-qr-access`, `add-notification-service`.
