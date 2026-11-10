## Why

El residente necesita crear y compartir pases desde el teléfono, y el guardia necesita
escanear el QR desde el mismo lugar. Hoy `apps/resident` es un stub PWA y no existe un
cliente móvil nativo. Se necesita una app Expo para Android/iOS que cubra ambos roles:
**Zima QR Access**.

Este change implementa el **MVP** de la app y deja las notificaciones para Phase 2.

## What Changes

- Crear `apps/zima-qr-access` (Expo + React Native + TypeScript).
- **Modo residente:**
  - login y selección de contexto/membresía;
  - crear pase: `locationUnitId` (unidad hoja de la membresía), nombre, apellido,
    cédula, vehículo + placa, PIN opcional, tipo `entry_only` o `entry_exit`, fechas y
    ventana diaria opcional;
  - mostrar el QR inicial dinámico;
  - compartir el link con el share sheet nativo;
  - historial, estado, revocar y regenerar link.
- **Modo guardia:**
  - login como `guard`;
  - escáner de QR con cámara;
  - resultado con nombre, apellido, cédula, placa, `locationPath` y autorizador;
  - Confirmar/Rechazar;
  - historial de escaneos del turno.
- **Phase 2 (fuera del MVP):**
  - notificaciones push, lista y deep links;
  - pases recurrentes;
  - selector de autorizador subusuario.
- **Non-goals:** no reemplaza el dashboard admin/operador, no biometría, no pagos, no
  modo offline, no escaneo desde el dashboard, no modo `community_admin` ni `operator`.
- **Distribución:** APK interno de Android primero; iOS/TestFlight después.

## Capabilities

### New Capabilities

- `zima-mobile-auth`: login, contexto, almacenamiento seguro y refresh.
- `zima-pass-creation`: formulario de pase, vehículo, PIN y horarios.
- `zima-pass-sharing`: QR inicial, compartir link, historial, revocar/regenerar.
- `zima-guard-scan`: cámara, escaneo, confirmar/rechazar e historial.
- `zima-notifications`: registro de Expo Push, lista y deep links (Phase 2).

## Impact

- **Nueva app**: `apps/zima-qr-access` (Expo, pnpm workspace, Metro).
- **API**: consume los endpoints de `add-dynamic-qr-access`.
- **Shared**: usa tipos/DTOs de `@porteria/shared`.
- **Config**: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_ENV`.
- **Depende de**: `add-dynamic-qr-access` (MVP).
- **Phase 2 depende de**: `add-notification-service` y `add-delegated-subusers`.
