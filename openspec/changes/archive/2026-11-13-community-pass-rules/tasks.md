## 1. Modelo de datos

- [x] 1.1 Agregar `passDailyLimitEnabled` (boolean, not null, default `true`) y `passDailyLimit` (integer, not null, default `50`) a `packages/database/src/schema/communities.ts`.
- [x] 1.2 Generar y aplicar la migración con `pnpm --filter @porteria/database db:generate` y `db:migrate`.
- [x] 1.3 Confirmar en la base que las comunidades existentes quedaron con el límite habilitado en 50.
- [x] 1.4 Recompilar `@porteria/database` antes de typechequear el API.

## 2. Contrato y API

- [x] 2.1 Sumar los dos campos a los tipos compartidos de comunidad en `packages/shared`.
- [x] 2.2 Aceptar los dos campos en `createCommunitySchema` y `updateCommunitySchema`, con `passDailyLimit` entero entre 1 y 500.
- [x] 2.3 Persistir los campos en el alta y la edición de comunidad (`organization-admin.routes.ts` y `communities.routes.ts`).
- [x] 2.4 Exponer ambos en el listado de comunidades y en el `overview` de la comunidad.
- [x] 2.5 En `createPass`, leer la regla de la comunidad antes de contar: si está deshabilitada o `PASS_DAILY_LIMIT_PER_UNIT` es `0`, saltear el bloque.
- [x] 2.6 Usar `passDailyLimit` de la comunidad como máximo y devolverlo en el cuerpo del rechazo como `max`.
- [x] 2.7 Confirmar que `createPassBatch` sigue sin aplicar el límite y dejar el comentario que lo explica.

## 3. Dashboard

- [x] 3.1 Agregar una sección «Reglas» al formulario de comunidad con un interruptor «Limitar autorizaciones por día» y un input numérico, con 50 por defecto.
- [x] 3.2 Deshabilitar el input cuando el interruptor está apagado, sin borrar el valor.
- [x] 3.3 Precargar ambos valores al editar una comunidad.
- [x] 3.4 Mostrar la regla en el detalle expandido de la comunidad.
- [x] 3.5 Validar el rango 1 a 500 con mensaje de campo.

## 4. Verificación

- [x] 4.1 Test de integración: comunidad con límite 2 rechaza la tercera autorización del día con `max: 2`.
- [x] 4.2 Test de integración: comunidad con el límite deshabilitado acepta más autorizaciones de las que permitiría el número guardado.
- [x] 4.3 Test de integración: `PASS_DAILY_LIMIT_PER_UNIT=0` desactiva el límite aunque la comunidad lo tenga habilitado.
- [x] 4.4 Test de integración: el lote no se ve afectado por el límite de la comunidad.
- [x] 4.5 Playwright: crear una comunidad con el límite apagado y verificar que el detalle lo refleja.
- [x] 4.6 `pnpm --filter @porteria/api exec tsc --noEmit` y `pnpm --filter @porteria/dashboard exec tsc --noEmit` sin errores.
- [x] 4.7 Suite completa de Playwright en verde.
- [x] 4.8 `pnpm exec openspec validate community-pass-rules --strict`.
