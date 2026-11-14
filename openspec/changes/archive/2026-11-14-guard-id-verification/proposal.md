# Proposal: guard id verification

## Why

El guardia sólo puede autorizar un ingreso escaneando el QR del pase. Si el visitante no tiene teléfono, no tiene datos o se quedó sin batería, no hay forma de verificarlo aunque la autorización exista y esté vigente. El campo de "token manual" no resuelve nada: es un hash de 64 caracteres que nadie va a tipear.

La cédula ya está registrada en el pase, porque el residente la carga al autorizar. Usarla como segunda vía cubre el caso real sin agregar datos nuevos.

## What Changes

- La pantalla del guardia deja el campo de token y pasa a ofrecer dos vías explícitas: **escanear QR** y **verificar por cédula**.
- Nueva búsqueda `GET /api/access/authorizations?document=...` que devuelve las autorizaciones activas de esa cédula en la comunidad del guardia.
- El guardia elige una de las autorizaciones listadas y confirma el ingreso. **La aplicación nunca aprueba sola.**
- La cámara puede leer el código de barras PDF417 del dorso de la cédula para llenar el número, sin tipearlo.
- La bitácora distingue estos ingresos con un origen propio, para que se pueda auditar cuántos accesos no pasaron por QR.

## Capabilities

### New Capabilities

- `guard-id-verification`: el guardia verifica una autorización por el documento del visitante cuando no hay QR disponible.

### Modified Capabilities

- `zima-guard-scan`: la pantalla suma la segunda vía y deja de pedir el token manual.

## Impact

- `server/api/src/routes/access.routes.ts` y un servicio de búsqueda por documento.
- `server/api/src/services/access-scan.service.ts`: registrar el ingreso con origen propio.
- `apps/zima-qr-access/app/scan.tsx`, `src/api/access.ts`.
- Sin cambios de base de datos: el documento ya vive en `access_passes`.

## Fuera de alcance

- Autorizar sin conexión. La verificación sigue necesitando red; un modo offline requiere cachear los pases vigentes y es otro change.
- Validar la autenticidad del documento. Eso lo hace el guardia mirando la cédula física.
- Leer el código PDF417 para extraer nombre y fecha de nacimiento. Sólo se usa el número.
