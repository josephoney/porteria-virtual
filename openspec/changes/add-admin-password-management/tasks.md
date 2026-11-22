## 1. Datos

- [ ] 1.1 Agregar `accounts.must_change_password` con valor por defecto falso.
- [ ] 1.2 Migración con rollback documentado.
- [ ] 1.3 Exponer el estado en los DTOs de cuenta.

## 2. Alcance

- [ ] 2.1 Implementar la resolución de objetivos permitidos por actor.
- [ ] 2.2 Rechazar pares, superiores, platform admins y cuentas de otra
  organización con 403.
- [ ] 2.3 Tests unitarios de la matriz completa, incluido el caso guardia.

## 3. Endpoint

- [ ] 3.1 `POST /api/accounts/:id/password` con `mode`, `password` y
  `mustChange`.
- [ ] 3.2 Modo `direct`: validar política, definir contraseña, marcar
  `must_change_password` según la casilla y devolver el valor una sola vez.
- [ ] 3.3 Modo `link`: emitir el token del flujo de recuperación y enviar el
  correo.
- [ ] 3.4 Revocar sesiones en ambos modos.
- [ ] 3.5 Registrar el evento de auditoría sin datos sensibles.

## 4. Bloqueo por cambio obligatorio

- [ ] 4.1 Rechazar login completo cuando `must_change_password` está activo,
  devolviendo la marca correspondiente.
- [ ] 4.2 Permitir sólo el endpoint de cambio de contraseña en ese estado.
- [ ] 4.3 Limpiar la marca al cambiar la contraseña.
- [ ] 4.4 Tests de login, refresh y salida del estado.

## 5. Interfaz

- [ ] 5.1 Acción «Cambiar contraseña» en el listado de usuarios.
- [ ] 5.2 Diálogo con modo, contraseña, confirmación y casilla de cambio
  obligatorio.
- [ ] 5.3 Mostrar la contraseña temporal una sola vez, con opción de copiar.
- [ ] 5.4 Ocultar la acción para objetivos fuera de alcance.
- [ ] 5.5 Pantalla de cambio obligatorio tras el login.

## 6. Verificación

- [ ] 6.1 Tests de integración: reseteo permitido, reseteo denegado,
  revocación de sesiones y cambio obligatorio.
- [ ] 6.2 Verificar que la contraseña no aparece en logs ni en auditoría.
- [ ] 6.3 `openspec validate add-admin-password-management --strict`.
