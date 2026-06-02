## Context

`server/api/` es actualmente un scaffold Fastify vacío (health endpoint solamente). `packages/database/` tiene el schema completo con 12 tablas incluyendo `users` (con `password_hash`, `role`, `organization_id`) y `refresh_tokens` (con `token_hash`, `expires_at`, `revoked`). `packages/shared/` tiene los DTOs de auth (`LoginRequest`, `LoginResponse`, `RefreshRequest`, `RefreshResponse`) y el enum `UserRole`.

Este change transforma `server/api/` en una API REST funcional con JWT auth completa.

## Goals / Non-Goals

**Goals:**
- Login con email/password validando contra PostgreSQL (bcrypt)
- JWT access token (15 min) firmado con RS256 o HS256
- Refresh token (7 días, rotativo, almacenado en `refresh_tokens`)
- Logout revoca el refresh token
- Middleware Fastify que protege rutas automáticamente
- RBAC: rutas accesibles solo por ciertos roles
- CRUD de usuarios: admin gestiona usuarios de su organización
- Perfil personal: `GET /api/me`
- Cambio de contraseña: `PATCH /api/me/password`
- Respuestas de error consistentes en formato `ApiError`

**Non-Goals:**
- No se implementa OAuth2, SSO, ni login social
- No se envía email de verificación ni recuperación de contraseña
- No se implementa rate limiting (fase posterior)
- No se migra el signaling server a usar auth (changes 4/5)
- No se crea frontend de login (change 5: dashboard-react)

## Decisions

### 1. JWT con refresh token rotation

**Decisión**: Access token JWT de 15 minutos + refresh token opaco de 7 días con rotación.

**Flujo**:
```
POST /api/auth/login
  → valida email + bcrypt password
  → genera access token (JWT, 15min, contiene { userId, email, role, orgId })
  → genera refresh token (random 64 bytes, hash SHA-256 → refresh_tokens.token_hash)
  → devuelve { accessToken, refreshToken, user }

POST /api/auth/refresh
  → busca refresh_tokens por token_hash
  → verifica no revocado, no expirado
  → revoca el viejo, genera nuevo par
  → devuelve { accessToken, refreshToken }

POST /api/auth/logout
  → revoca el refresh token (revoked = true)
```

**Alternativas**:
- **Solo access token sin refresh**: Muy inseguro. Si el token se roba, está activo 15 minutos y no se puede revocar.
- **Access token long-lived (24h+)**: Sin refresh, si se compromete, la ventana de ataque es enorme.

**Razonamiento**: El patrón access+refresh es el estándar de industria. Refresh token rotativo previene replay attacks.

### 2. HS256 sobre RS256 para JWT

**Decisión**: HS256 (HMAC with SHA-256) con secret compartido.

**Alternativas**:
- **RS256**: Requiere par de claves pública/privada. Más seguro para arquitecturas distribuidas donde múltiples servicios validan tokens sin compartir secret.

**Razonamiento**: HS256 es más simple para monorepo. Todos los servicios comparten el mismo secret. Si en el futuro se separan en microservicios, se migra a RS256.

### 3. Estructura del server: routes → services → database

**Decisión**: Separación de concerns en 3 capas dentro de `server/api/src/`.

```
server/api/src/
├── index.ts              # Fastify app factory + start
├── config.ts             # Env vars tipadas
├── plugins/
│   ├── auth.ts            # JWT verification decorator
│   └── error-handler.ts   # Error formatting
├── routes/
│   ├── auth.routes.ts     # /api/auth/*
│   └── users.routes.ts    # /api/users/*
├── services/
│   ├── auth.service.ts    # Lógica de login/refresh/logout
│   └── users.service.ts   # Lógica de CRUD
└── middlewares/
    └── rbac.ts            # requireRole('admin')
```

**Razonamiento**: Separar rutas (HTTP concerns) de servicios (lógica de negocio) de DB (queries) facilita testing y mantenimiento. El patrón es estándar en Fastify (similar a NestJS pero sin decorators).

### 4. bcryptjs sobre bcrypt nativo

**Decisión**: `bcryptjs` (JavaScript puro).

**Alternativas**:
- **bcrypt**: Binding nativo en C++. Más rápido pero requiere compilación nativa y puede fallar en algunos entornos (especialmente ARM/RPi).

**Razonamiento**: `bcryptjs` funciona en cualquier plataforma sin compilación nativa. La diferencia de velocidad (~30%) es irrelevante para logins (operación poco frecuente). El kiosk en RPi ARM se beneficia de no tener dependencias nativas.

### 5. Validación con Zod

**Decisión**: Zod para validación de schemas de request en Fastify.

**Alternativas**:
- **JSON Schema nativo de Fastify**: Sin type inference automática.
- **TypeBox**: Bueno pero menos ecosistema que Zod.

**Razonamiento**: Zod tiene inferencia de tipos TypeScript automática y `.parse()` produce tipos. Fastify tiene integración con Zod vía adaptador.

### 6. Soft delete para usuarios

**Decisión**: Usar columna `active: boolean` en vez de `DELETE`.

**Razonamiento**: La bitácora de eventos referencia `actor_id` de usuarios. Si se elimina un usuario físicamente, los eventos históricos quedan huérfanos. Soft delete preserva la integridad referencial de la auditoría.

## Risks / Trade-offs

- **[Riesgo] JWT_SECRET en .env local** → Mitigación: `.env` ya está en `.gitignore`. En producción se usa secrets manager o variables de entorno del sistema.
- **[Riesgo] Sin rate limiting en login** → Un atacante podría hacer brute force. Mitigación futura: agregar rate limiting con Redis en próxima iteración.
- **[Trade-off] Access token en header vs cookie** → Se usa header `Authorization: Bearer <token>`. Más portable para SPAs y apps móviles que cookies httpOnly (que requieren mismo dominio). El refresh token igual se envía en el body (no en cookie), lo cual es menos seguro contra XSS pero más simple para desarrollo.
- **[Trade-off] Refresh tokens en DB vs JWT autónomo** → Almacenar en DB permite revocación inmediata. El costo es una query extra en cada refresh (operación poco frecuente).
