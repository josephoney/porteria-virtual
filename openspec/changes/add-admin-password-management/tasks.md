## 1. Datos

- [x] 1.1 Agregar `accounts.must_change_password` con valor por defecto falso.
- [x] 1.2 Migración con rollback documentado (`0039_must_change_password.sql`).
- [ ] 1.3 Exponer el estado en los DTOs de cuenta.

## 2. Alcance

- [x] 2.1 Implementar la resolución de objetivos permitidos por actor
      (`canManagePassword`, `loadTarget`).
- [x] 2.2 Rechazar pares, superiores, platform admins y cuentas de otra
      organización con 403.
- [x] 2.3 Tests de la matriz, incluidos pares, contraseña corta y cuenta ajena.

## 3. Endpoint

- [x] 3.1 `POST /api/accounts/:id/password` con `mode`, `password` y
      `mustChange`.
- [x] 3.2 Modo `direct`: valida la política, define la contraseña, marca
      `must_change_password` según la casilla y devuelve la temporal una sola vez.
- [x] 3.3 Modo `link`: emite el token del flujo de recuperación y envía el correo.
- [x] 3.4 Revocar sesiones en ambos modos.
- [x] 3.5 Registrar el evento de auditoría sin datos sensibles.

## 4. Bloqueo por cambio obligatorio

- [x] 4.1 Mientras `must_change_password` esté activo, toda la API responde 403
      `password_change_required` salvo el perfil y el cambio de contraseña.
- [x] 4.2 Sólo `/api/me` y `/api/me/password` quedan abiertos en ese estado.
- [x] 4.3 `setPassword` limpia la marca: cualquier cambio deliberado de
      contraseña salda la obligación.
- [x] 4.4 Tests: la API queda cerrada con la temporal activa, el perfil sigue
      accesible y al cambiarla vuelve el acceso.

## 5. Interfaz

- [x] 5.1 Acción «Cambiar contraseña» en el listado de usuarios, como ícono en el
      grupo de acciones de la membresía.
- [ ] 5.2 Diálogo con modo, contraseña, confirmación y casilla de cambio
      obligatorio. Hechos la contraseña, la casilla y el aviso; faltan el
      selector de modo (`direct`/`link`) y el campo de confirmación.
- [x] 5.3 Mostrar la contraseña temporal una sola vez, con opción de copiar.
- [x] 5.4 Ocultar la acción para objetivos fuera de alcance.
- [x] 5.5 Pantalla de cambio obligatorio tras el login: `/change-password`, con
      redirección automática cuando la API responde `password_change_required`.

## 6. Verificación

- [x] 6.1 Tests de integración: reseteo permitido, reseteo denegado, revocación
      de sesiones y cambio obligatorio.
- [x] 6.2 Verificar que la contraseña no aparece en logs ni en auditoría.
- [x] 6.3 `openspec validate add-admin-password-management --strict`.
