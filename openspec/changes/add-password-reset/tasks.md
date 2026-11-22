## 1. Base de datos

- [ ] 1.1 Crear `password_reset_tokens` con `account_id`, `token_hash` único,
  `expires_at`, `consumed_at`, `created_at` e índices por cuenta y por vigencia.
- [ ] 1.2 Migración con bloque de rollback documentado.
- [ ] 1.3 Modelo y relaciones en `packages/database`.

## 2. Servicio

- [ ] 2.1 Implementar `requestReset(email)` con generación de token aleatorio y
  hash antes de persistir.
- [ ] 2.2 Invalidar tokens previos de la misma cuenta al emitir uno nuevo.
- [ ] 2.3 Implementar `consumeReset(token, newPassword)` transaccional:
  validar vigencia, verificar hash, actualizar contraseña, marcar uso, revocar
  sesiones y limpiar cambio obligatorio.
- [ ] 2.4 Rechazar tokens vencidos, consumidos o inexistentes con un código
  estable.
- [ ] 2.5 Tests unitarios de vigencia, reuso, invalidación previa y revocación.

## 3. Endpoints

- [ ] 3.1 `POST /api/auth/password/forgot` público, respuesta uniforme 202.
- [ ] 3.2 `POST /api/auth/password/reset` público, con validación de política.
- [ ] 3.3 Límite de frecuencia por email y por IP.
- [ ] 3.4 No registrar el token ni el correo en los logs.

## 4. Correo

- [ ] 4.1 Agregar `sendPasswordResetEmail` al servicio de correo existente.
- [ ] 4.2 Redactar texto plano y HTML escapado, con vigencia visible.
- [ ] 4.3 Si el correo falla, la respuesta pública no cambia.

## 5. Interfaz

- [ ] 5.1 Enlace «Olvidé mi contraseña» en el login.
- [ ] 5.2 Pantalla de solicitud con mensaje neutro de confirmación.
- [ ] 5.3 Pantalla `/reset-password` con token, nueva contraseña y confirmación.
- [ ] 5.4 Manejo de token vencido o consumido con salida clara hacia el login.

## 6. Verificación

- [ ] 6.1 Tests de integración: solicitud, consumo, reuso rechazado, vencimiento
  y sesiones revocadas.
- [ ] 6.2 Verificar que un correo inexistente produce la misma respuesta.
- [ ] 6.3 Prueba manual del correo en staging.
- [ ] 6.4 `openspec validate add-password-reset --strict`.
