## Context

`auth.routes.ts` sólo expone login, refresh, context y logout. El correo con
token ya funciona para invitaciones y el servicio de correo sabe redactar HTML y
texto, con tiempo límite y sin loguear el token.

## Goals / Non-Goals

**Goals:**

- Que una persona pueda recuperar el acceso sin intervención humana.
- No revelar qué correos están registrados.
- Que el enlace sea de un solo uso y de vida corta.

**Non-Goals:**

- No se agrega seteo por administrador ni cambio obligatorio; van en
  `add-admin-password-management`.
- No se implementa segundo factor.

## Decisions

### 1. Tabla propia, no reutilizar invitaciones

**Decisión:** `password_reset_tokens` separada de `invitations`.

**Por qué:** vida útil, audiencia y semántica distintas. Una invitación crea
identidad; un reset sólo cambia una credencial existente. Mezclarlas obliga a
ramificar permisos en el mismo registro.

### 2. Token hasheado, un solo uso, 45 minutos

**Decisión:** guardar `sha256(token)`, con `expires_at` y `consumed_at`. Una
nueva solicitud invalida los tokens anteriores de la misma cuenta.

**Por qué:** si se filtra la base, el token en claro no sirve. Invalidar los
anteriores evita que queden varios enlaces vivos.

### 3. Respuesta uniforme

**Decisión:** `forgot` responde 202 con el mismo cuerpo exista o no la cuenta.

**Por qué:** cualquier diferencia convierte el endpoint en un enumerador de
usuarios. Se aplica también al tiempo de respuesta: el envío de correo se
dispara sin bloquear la respuesta.

### 4. Límite de frecuencia

**Decisión:** límite por email y por IP, independiente del límite de login.

**Por qué:** sin él, el endpoint sirve para inundar de correos a un tercero.

### 5. El reset no pide la contraseña actual

**Decisión:** el token es la única prueba de identidad, más la política de
longitud.

**Por qué:** pedir la contraseña actual contradice el propósito del flujo.

### 6. Efectos del reset

**Decisión:** al consumir el token, en una sola transacción: se actualiza la
contraseña, se marca el token usado, se revocan todas las sesiones y se limpia
cualquier cambio obligatorio pendiente.

**Por qué:** el usuario acaba de demostrar control del correo y eligió una
contraseña nueva; dejar sesiones viejas vivas anula el propósito.

### 7. Enlace público

**Decisión:** `${PUBLIC_APP_URL}/reset-password?token=...`, con la misma base
que usan las invitaciones.

**Por qué:** evita depender del entorno del navegador y mantiene un solo origen.
