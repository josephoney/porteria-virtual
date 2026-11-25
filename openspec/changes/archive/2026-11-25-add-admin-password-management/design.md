## Context

El único cambio de contraseña es el self-service, que exige la contraseña
actual. El administrador no tiene ninguna acción sobre credenciales ajenas. El
correo con token ya existe para invitaciones y para el reset.

## Goals / Non-Goals

**Goals:**

- Que un administrador pueda destrabar a alguien que olvidó su contraseña.
- Que el alcance sea explícito y no permita escalada.
- Que toda acción quede auditada.

**Non-Goals:**

- No se permite resetear a un par o a un superior.
- No se implementa suplantación de sesión.
- No se implementa segundo factor.

## Decisions

### 1. Matriz de alcance

**Decisión:**

| Actor | Objetivos permitidos |
|---|---|
| `org_admin` | `community_admin`, `guard`, `resident` de su organización |
| `community_admin` | `resident` de su comunidad |
| Nadie | otro `org_admin`, `platform_admin`, cuentas de otra organización |

**Por qué:** el guardia puede depender de una organización externa a la
comunidad, así que sólo el `org_admin` responde por su credencial. Permitir que
un `community_admin` resetee a un par convertiría el reseteo en una escalada de
privilegios.

**Consecuencia aceptada:** un `community_admin` no puede destrabar a un guardia.
Si el caso es frecuente, el guardia usa el autoservicio.

### 2. Dos modos

**Decisión:** `direct` define la contraseña; `link` envía el enlace de
recuperación.

**Por qué:** el modo presencial resuelve al guardia sin correo accesible; el
modo enlace es más seguro porque el usuario elige la contraseña y el
administrador nunca la conoce.

### 3. Contraseña temporal vs definitiva

**Decisión:** si se marca «solicitar cambio en el próximo ingreso», la
contraseña es temporal y `must_change_password = true`. Sin la casilla, es
definitiva.

**Riesgo conocido:** con contraseña definitiva el administrador conoce la
credencial del usuario y puede usarla. La mitigación es auditoría obligatoria y
mostrar el valor una sola vez, sin posibilidad de consultarlo después.

### 4. Bloqueo por cambio obligatorio

**Decisión:** mientras `must_change_password` esté activo, el sistema sólo
permite la ruta de cambio de contraseña.

**Por qué:** una contraseña temporal que no se reemplaza deja de ser temporal.

### 5. Revocación

**Decisión:** el reseteo revoca todas las sesiones de la cuenta objetivo en la
misma transacción.

### 6. Auditoría

**Decisión:** evento `account.password_reset` con actor, objetivo, método,
resultado y origen. Nunca incluye la contraseña.

### 7. Superficie

**Decisión:** la acción vive en el listado de usuarios del dashboard y respeta
los roles ya existentes en la navegación.
