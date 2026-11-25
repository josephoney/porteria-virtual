## 1. Base de datos

- [x] 1.1 Crear `password_reset_tokens` con `account_id`, `token_hash` único,
      `expires_at`, `used_at`, `requested_ip`, `created_at` e índices por cuenta
      y por vigencia.
- [x] 1.2 Migración con bloque de rollback documentado (comentario al final de
      `0038_password_reset_tokens.sql`).
- [x] 1.3 Modelo y relaciones en `packages/database`.

## 2. Servicio

- [x] 2.1 Implementar `requestPasswordReset(email)` con generación de token
      aleatorio y hash antes de persistir.
- [x] 2.2 Invalidar tokens previos de la misma cuenta al emitir uno nuevo.
- [x] 2.3 Implementar `resetPassword(token, passwordHash)` transaccional:
      validar vigencia, marcar uso, actualizar contraseña y revocar sesiones.
      La limpieza de «cambio obligatorio» queda para
      `add-admin-password-management`, que es donde nace ese campo.
- [x] 2.4 Rechazar tokens vencidos, consumidos o inexistentes con un código
      estable (`invalid_token` / `expired_token`).
- [x] 2.5 Tests de vigencia, reuso, invalidación previa y revocación de sesiones.

## 3. Endpoints

- [x] 3.1 `POST /api/auth/password/forgot` público, con respuesta uniforme.
- [x] 3.2 `POST /api/auth/password/reset` público, con validación de política
      (mínimo ocho caracteres).
- [x] 3.3 Límite de frecuencia por email y por IP.
- [x] 3.4 No registrar el token ni el correo en los logs (el token y la URL se
      redactan en el error del proveedor).

## 4. Correo

- [x] 4.1 Agregar `sendPasswordResetEmail` al servicio de correo existente.
- [x] 4.2 Redactar texto plano y HTML, con la vigencia visible y la aclaración de
      que la contraseña actual sigue sirviendo si no fue la persona.
- [x] 4.3 Si el correo falla, la respuesta pública no cambia.

## 5. Interfaz

- [x] 5.1 Enlace «Olvidé mi contraseña» en el login.
- [x] 5.2 Pantalla de solicitud con mensaje neutro de confirmación.
- [x] 5.3 Pantalla `/reset-password` con token, nueva contraseña y confirmación.
- [x] 5.4 Manejo de token vencido o consumido con salida clara hacia el login.

## 6. Verificación

- [x] 6.1 Tests de integración: solicitud, consumo, reuso rechazado, vencimiento
      y sesiones revocadas.
- [x] 6.2 Verificar que un correo inexistente produce la misma respuesta.
- [ ] 6.3 Prueba manual del correo en staging: pedir el enlace con una cuenta
      real y abrirlo desde el buzón.
