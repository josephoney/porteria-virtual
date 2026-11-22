## 1. Preparación

- [ ] 1.1 Inventariar las 33 referencias a `users` y clasificarlas en lectura
  de identidad, lectura de credencial y escritura.
- [ ] 1.2 Crear `server/api/src/services/credentials.service.ts` con
  `hashPassword`, `verifyPassword`, `setPassword`, `revokeAllSessions` y la
  política de longitud mínima.
- [ ] 1.3 Reemplazar los usos directos de `bcrypt` por el módulo nuevo.
- [ ] 1.4 Agregar tests unitarios del módulo, incluida la revocación de sesiones.

## 2. Backfill de sesiones

- [ ] 2.1 Migración: agregar `refresh_tokens.account_id` nullable.
- [ ] 2.2 Backfill por email entre `users` y `accounts`, informando filas sin
  correspondencia.
- [ ] 2.3 Revisar manualmente las filas sin correspondencia antes de continuar.
- [ ] 2.4 Migración: `account_id` pasa a `NOT NULL` y se elimina `user_id`.
- [ ] 2.5 Actualizar el modelo y las consultas de refresh token.

## 3. Autenticación sobre `accounts`

- [ ] 3.1 Cambiar login, refresh, context y logout para operar sólo con
  `account_id` y `person_id`.
- [ ] 3.2 Unificar la verificación de contraseña en las dos ramas actuales de
  `auth.service.ts`.
- [ ] 3.3 Ajustar `changePassword` para usar `setPassword` y dejar de escribir
  en `users`.
- [ ] 3.4 Tests de integración: login, refresh, logout, cambio de contraseña y
  sesión invalidada tras el cambio.

## 4. Compatibilidad de `users`

- [ ] 4.1 Reemplazar la tabla `users` por una vista equivalente de solo lectura.
- [ ] 4.2 Verificar que las 33 referencias siguen funcionando.
- [ ] 4.3 Documentar que la vista no admite escritura.

## 5. Retiro

- [ ] 5.1 Reescribir las referencias restantes contra `people` y `accounts`.
- [ ] 5.2 Eliminar la vista `users`.
- [ ] 5.3 Actualizar bootstrap, seed y scripts de administración.
- [ ] 5.4 Tests de integración completos en verde.

## 6. Verificación

- [ ] 6.1 `pnpm --filter @porteria/api exec tsc --noEmit`.
- [ ] 6.2 Suites unitaria e integración completas.
- [ ] 6.3 Migración probada en una base restaurada de producción.
- [ ] 6.4 `openspec validate unify-account-credentials --strict`.
