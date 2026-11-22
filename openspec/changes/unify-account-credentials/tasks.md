## 1. Preparación

- [x] 1.1 Inventariar las 33 referencias a `users` y clasificarlas en lectura
      de identidad, lectura de credencial y escritura.
- [x] 1.2 Crear `server/api/src/services/credentials.service.ts` con
      `hashPassword`, `verifyPassword`, `setPassword`, `revokeAllSessions` y la
      política de longitud mínima.
- [x] 1.3 Reemplazar los usos directos de `bcrypt` por el módulo nuevo.
      Quedan fuera a propósito: el hash de PIN de pases (`pass.service`,
      `public-pass.service`), que no es una credencial de cuenta, y
      `packages/database` (`seed`, `bootstrap-admin`), que no puede importar
      desde `server/api`.
- [x] 1.4 Agregar tests unitarios del módulo, incluida la revocación de sesiones.
      La revocación se cubre en integración en 3.4, que es donde cambia el flujo
      de sesiones.

## 2. Backfill de sesiones

- [x] 2.1 Migración: agregar `refresh_tokens.account_id` nullable.
      Ya existía desde `0009_lively_northstar.sql`; no hizo falta una migración
      nueva.
- [x] 2.2 Backfill por email entre `users` y `accounts`, informando filas sin
      correspondencia. También quedó cubierto por `0009`.
- [x] 2.3 Revisar manualmente las filas sin correspondencia antes de continuar.
      La guarda de la migración abortó con 5 `users` sin cuenta; todas eran
      fixtures `@test.local` de corridas de integración anteriores, eliminadas
      antes de migrar.
- [x] 2.4 Migración: `account_id` pasa a `NOT NULL` y se elimina `user_id`.
      `0025_refresh_tokens_account_only.sql`, con guardas que abortan si quedan
      tokens sin cuenta o `users` sin `accounts`.
- [x] 2.5 Actualizar el modelo y las consultas de refresh token.

## 3. Autenticación sobre `accounts`

- [x] 3.1 Cambiar login, refresh, context y logout para operar con `account_id`
      y `person_id`. Login, refresh, cambio de contexto y logout resuelven las
      membresías por `person_id`, y la guarda de `plugins/auth.ts` compara
      `membership.personId` contra el token. `sub` sigue siendo `users.id`
      porque `calls.operator_id` e `invitations.invited_by` son FKs a `users`;
      migrarlas pertenece a 5.1.
      Pendiente parcial: las credenciales, la sesión y la identidad ya salen de
      `accounts` (login verifica `accounts.passwordHash`, refresh resuelve por
      `account_id`, logout opera por hash del token). Lo que aún lee `users` es
      el resumen de sesión (`id`, `name`, `active`) y la resolución de
      membresías, porque `memberships.user_id` es `NOT NULL` y
      `memberships.person_id` es nullable. Quitar esa dependencia exige migrar
      la tabla de membresías a `person_id`, que corresponde a 5.1.
- [x] 3.2 Unificar la verificación de contraseña en las dos ramas actuales de
      `auth.service.ts`.
      Ya no hay dos ramas: `authenticate()` lee sólo `accounts`.
- [x] 3.3 Ajustar `changePassword` para usar `setPassword` y dejar de escribir
      en `users`.
      `changePassword` resuelve la cuenta por email, verifica contra
      `accounts.passwordHash` y llama a `setPassword`, que además revoca las
      sesiones abiertas. La ruta mapea `PasswordPolicyError` a 400.
- [x] 3.4 Tests de integración: login, refresh, logout, cambio de contraseña y
      sesión invalidada tras el cambio.
      `server/api/test/auth.integration.test.ts`, 7 casos, agregado al script
      `test:integration`.

## 4. Compatibilidad de `users`

- [ ] 4.1 Reemplazar la tabla `users` por una vista equivalente de solo lectura.
- [ ] 4.2 Verificar que las 33 referencias siguen funcionando.
- [ ] 4.3 Documentar que la vista no admite escritura.

## 5. Retiro

- [ ] 5.1 Reescribir las referencias restantes contra `people` y `accounts`.
      Hecho: `calls.operator_id` pasó a `operator_person_id` (`0027`), con filtros,
      joins y dashboard por persona. Falta: `invitations.invited_by`, los joins por
      `memberships.user_id` y las escrituras que quedan en `users`.
- [ ] 5.2 Eliminar la vista `users`.
- [ ] 5.3 Actualizar bootstrap, seed y scripts de administración.
- [ ] 5.4 Tests de integración completos en verde.

## 6. Verificación

- [ ] 6.1 `pnpm --filter @porteria/api exec tsc --noEmit`.
- [ ] 6.2 Suites unitaria e integración completas.
- [ ] 6.3 Migración probada en una base restaurada de producción.
- [ ] 6.4 `openspec validate unify-account-credentials --strict`.
