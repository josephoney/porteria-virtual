## 1. API Foundation

- [x] 1.1 Create `server/api/src/config.ts` — typed env config with JWT_SECRET, JWT_REFRESH_SECRET, DB credentials
- [x] 1.2 Create `server/api/src/plugins/error-handler.ts` — centralized error formatting for Fastify
- [x] 1.3 Update `server/api/src/index.ts` — register CORS, sensible headers, error handler, DB connection, health check
- [x] 1.4 Add `@porteria/database` as workspace dependency in `server/api/package.json`
- [x] 1.5 Add dependencies: `@fastify/jwt`, `jsonwebtoken`, `bcryptjs`, `zod`, `@fastify/cors` (may already exist)
- [x] 1.6 Run `pnpm install` and verify `tsc --noEmit` passes

## 2. JWT Authentication

- [x] 2.1 Create `server/api/src/plugins/auth.ts` — Fastify plugin that adds JWT verification via `@fastify/jwt`
- [x] 2.2 Create `server/api/src/routes/auth.routes.ts` — POST /api/auth/login handler
- [x] 2.3 Create `server/api/src/services/auth.service.ts` — login logic: validate email, compare bcrypt, generate JWT, create refresh token
- [x] 2.4 Implement POST /api/auth/refresh — validate refresh token, revoke old, issue new pair
- [x] 2.5 Implement POST /api/auth/logout — mark refresh token as revoked
- [x] 2.6 Create `server/api/src/middlewares/rbac.ts` — `requireRole(...roles)` middleware

## 3. User Management

- [x] 3.1 Create `server/api/src/routes/users.routes.ts` — protected route group with auth middleware
- [x] 3.2 Create `server/api/src/services/users.service.ts` — CRUD logic using `@porteria/database`
- [x] 3.3 Implement GET /api/users — list users (admin only, paginated, scoped to org)
- [x] 3.4 Implement GET /api/users/:id — get user by ID (admin or self)
- [x] 3.5 Implement POST /api/users — create user (admin only, hashes password with bcrypt)
- [x] 3.6 Implement PATCH /api/users/:id — update user (admin only, email immutable)
- [x] 3.7 Implement GET /api/me — current user profile
- [x] 3.8 Implement PATCH /api/me/password — change password with current password verification
- [x] 3.9 Create `server/api/src/schemas/` — Zod validation schemas for all request bodies

## 4. Integration & Verification

- [x] 4.1 Start `server/api` with `pnpm dev` and verify health endpoint responds
- [x] 4.2 Test POST /api/auth/login with seed user: `admin@porteria.local / porteria123` returns tokens
- [x] 4.3 Test GET /api/me with access token returns user profile
- [x] 4.4 Test POST /api/auth/refresh returns new token pair
- [x] 4.5 Test GET /api/users with admin token returns seeded users
- [x] 4.6 Test POST /api/users with admin token creates a new user
- [x] 4.7 Test POST /api/auth/login with wrong password returns 401
- [x] 4.8 Test GET /api/users with operator token returns 403
- [x] 4.9 Test PATCH /api/me/password changes password successfully
- [x] 4.10 Test login with new password after password change
