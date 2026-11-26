## Why

Hoy no existe forma de recuperar una contraseña olvidada. El único cambio
disponible exige la contraseña actual, así que quien la olvidó depende de que un
administrador intervenga a mano — y todavía no existe esa herramienta. El
resultado es una cuenta bloqueada y un pedido de soporte.

El servicio de correo con token ya está implementado y probado para invitaciones,
así que el costo de este flujo es bajo y el beneficio operativo es inmediato.

## What Changes

- Nueva tabla `password_reset_tokens` con token hasheado, vigencia y uso único.
- `POST /api/auth/password/forgot`: solicita el enlace. Responde igual exista o
  no la cuenta.
- `POST /api/auth/password/reset`: consume el token y define la contraseña nueva.
- Envío del correo por el servicio de correo existente.
- Límite de frecuencia por email y por IP.
- Al completar el reset se revocan todas las sesiones de la cuenta.
- En el login aparece «Olvidé mi contraseña» y una pantalla pública de reset.

## Capabilities

### New Capabilities

- `password-reset`: solicitud, token, consumo, vigencia y límites del flujo de
  recuperación.

### Modified Capabilities

- `jwt-auth`: el reset invalida sesiones existentes.
- `user-management`: superficie pública de recuperación.

## Impact

- **DB**: `password_reset_tokens`.
- **API**: dos endpoints públicos y un método nuevo en el servicio de correo.
- **Shared**: DTOs de solicitud y reset.
- **Dashboard**: enlace en login y página `/reset-password`.
- **Depende de:** `unify-account-credentials` (fuente única de credenciales).
