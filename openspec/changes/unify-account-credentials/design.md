## Context

`people` ya es la identidad global y `accounts` la credencial opcional, pero
`users` sobrevivió como tabla con `email`, `passwordHash`, `name`,
`isPlatformAdmin` y `active`. Sus membresías y varios servicios siguen
consultándola. `changePassword` valida contra `users` y después replica el hash
en `accounts` buscando por email.

## Goals / Non-Goals

**Goals:**

- Una sola fuente de verdad para la contraseña.
- Ningún flujo nuevo puede escribir en dos lugares.
- Las sesiones se pueden revocar de forma confiable.
- Migrar sin ventana de inconsistencia.

**Non-Goals:**

- No se agregan flujos de reset ni de administración (van en cambios propios).
- No se toca el modelo de permisos.

## Decisions

### 1. `accounts` es la única fuente

**Decisión:** toda contraseña vive en `accounts.password_hash`. `users` pierde
esa columna.

**Alternativa descartada:** mantener doble escritura encapsulada en un módulo.
Se descarta porque el problema no es dónde se escribe sino que existan dos
lugares que puedan divergir.

### 2. `users` como vista durante la transición

**Decisión:** en la fase intermedia `users` se reemplaza por una vista de solo
lectura sobre `people` + `accounts`, para que las 33 referencias sigan
funcionando sin reescribirlas de golpe. Al final se elimina la vista y se
actualizan las referencias.

**Por qué una vista y no dejar la tabla:** una vista no admite escritura, así
que cualquier código que intente escribir ahí falla de inmediato en vez de
desincronizar datos en silencio.

**Riesgo:** una vista con `is_platform_admin` o `active` exige que esos campos
estén en `accounts`; ya lo están.

### 3. `refresh_tokens` se vincula a la cuenta

**Decisión:** backfill de `account_id` por email, luego `account_id` pasa a
`NOT NULL` y `user_id` se elimina.

**Por qué:** un token de sesión pertenece a una credencial, no a una identidad.
Si mañana una persona tiene dos cuentas, el token tiene que decir cuál.

### 4. Un solo módulo de credenciales

**Decisión:** `credentials.service.ts` expone `hashPassword`, `verifyPassword`,
`setPassword`, `revokeAllSessions` y la política de longitud. `bcrypt` sólo se
importa ahí.

**Por qué:** concentra el punto donde se puede olvidar revocar sesiones.

### 5. Revocación obligatoria al cambiar credencial

**Decisión:** `setPassword` revoca todos los refresh tokens activos de la cuenta
en la misma transacción.

### 6. Orden de migración

1. Agregar lo aditivo y crear el módulo de credenciales.
2. Backfill de `refresh_tokens.account_id` y verificación de conteos.
3. Cambiar las lecturas de autenticación a `accounts`.
4. Reemplazar `users` por la vista de compatibilidad.
5. Reemplazar las referencias restantes y eliminar la vista.

Cada fase es desplegable de forma independiente y reversible, salvo la última.
