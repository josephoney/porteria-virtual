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
- [x] 3.5 Registrar el evento de auditoría sin datos sensibles (test que el
      evento no contiene la contraseña).

## 4. Bloqueo por cambio obligatorio

- [ ] 4.1 Rechazar login completo cuando `must_change_password` esté activo,
      devolviendo la marca correspondiente.
- [ ] 4.2 Permitir sólo el endpoint de cambio de contraseña en ese estado.
- [ ] 4.3 Limpiar la marca al cambiar la contraseña (el flujo de recuperación ya
      la limpia; falta el cambio autenticado).
- [ ] 4.4 Tests de login, refresh y salida del estado.

## 5. Interfaz

- [ ] 5.1 Acción «Cambiar contraseña» en el listado de usuarios.
- [ ] 5.2 Diálogo con modo, contraseña, confirmación y casilla de cambio
      obligatorio.
- [ ] 5.3 Mostrar la contraseña temporal una sola vez, con opción de copiar.
- [ ] 5.4 Ocultar la acción para objetivos fuera de alcance.
- [ ] 5.5 Pantalla de cambio obligatorio tras el login.

## 6. Verificación

- [ ] 6.1 Tests de integración: reseteo permitido, reseteo denegado, revocación
      de sesiones y cambio obligatorio. Hechos los tres primeros; falta el
      cambio obligatorio, que depende de la sección 4.
- [x] 6.2 Verificar que la contraseña no aparece en logs ni en auditoría.
- [x] 6.3 `openspec validate add-admin-password-management --strict`.
