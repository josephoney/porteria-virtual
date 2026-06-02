## Why

Hoy el sistema no tiene autenticación — cualquiera puede emitir `operator:register` por Socket.io sin credenciales. No hay RBAC, no hay trazabilidad de acciones, y los datos de la bitácora pierden valor sin saber quién ejecutó cada evento. Con la base de datos y el schema ya creados en `database-schema`, este change construye la capa de autenticación y gestión de usuarios vía API REST, habilitando que el dashboard, kiosk y app residente tengan login real.

## What Changes

- Implementar JWT authentication en `server/api/`: login, refresh token rotation, logout
- Crear middleware de autenticación Fastify que valida JWT en cada request protegido
- Crear middleware de autorización RBAC por rol (admin, operator, guard, resident)
- Exponer endpoints CRUD de usuarios protegidos por rol
- Hashear contraseñas con bcrypt (12 rounds)
- Conectar `server/api/` al package `@porteria/database` para queries reales
- Estructurar la API con separación de concerns: routes → services → database
- Manejo de errores centralizado con respuestas JSON consistentes

## Capabilities

### New Capabilities
- `jwt-auth`: Login con email/password, generación de JWT access token (15min) + refresh token (7d rotativo), endpoint de refresh, logout con revocación, y middleware Fastify que protege rutas.
- `user-management`: CRUD de usuarios con RBAC. Admin crea/lista/edita/desactiva usuarios de su organización. Cada usuario ve su propio perfil. Contraseñas hasheadas con bcrypt.
- `api-foundation`: Estructura base de la API — plugins Fastify (CORS, sensible headers, error handler), separación routes/services, responses JSON estandarizadas, y validación de schemas.

### Modified Capabilities
<!-- Ninguno — el server/api era un scaffold vacío, no hay specs previas -->

## Impact

- **Server**: `server/api/` pasa de scaffold vacío a API funcional con auth + users CRUD
- **Dependencias nuevas**: `@fastify/jwt`, `@fastify/cookie`, `jsonwebtoken`, `bcryptjs`, `zod` (validación)
- **Base de datos**: Usa tablas `users` y `refresh_tokens` creadas en `database-schema`
- **Variables de entorno**: Nuevas: `JWT_SECRET`, `JWT_REFRESH_SECRET` (ya definidas en `.env.example` y `.env`)
- **No hay breaking changes**: El legacy server y las apps React no se tocan
