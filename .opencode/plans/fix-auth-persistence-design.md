## Context

El dashboard usa React Context (`AuthContext`) con `useState` para almacenar el token JWT. El servidor Fastify tiene un sistema completo de refresh tokens con rotacion (tabla `refresh_tokens`, endpoint `POST /api/auth/refresh`), pero el cliente nunca lo usa.

**Current flow (broken):**
```
Login -> setToken(accessToken) -> refreshToken descartado
Reload -> useState(null) -> RequireAuth redirige a /login
401 -> silencio, el componente crashea
Logout -> solo limpia estado React, refresh token sigue vivo en DB
```

**Target flow:**
```
Login -> localStorage.set(access, refresh, user) + setState
Reload -> AuthProvider.init() -> lee localStorage -> intenta refresh()
         +-- ok -> setState, listo
         +-- fail -> estado vacio, RequireAuth redirige
API call -> apiClient.get()
           +-- 200 -> ok
           +-- 401 -> intenta refresh() -> retry -> ok
           +-- refresh fail -> logout() -> /login
Logout -> POST /api/auth/logout + clearStorage + clearState
```

## Goals / Non-Goals

**Goals:**
- Token persiste entre recargas de pagina via localStorage
- Refresh token se usa para renovar sesion al iniciar (init refresh)
- Refresh reactivo automatico cuando una API responde 401
- Logout revoca el refresh token en el servidor
- `apiClient` centralizado como unica forma de hacer requests autenticadas
- Migrar `UsersTable` a `apiClient`
- 30+ minutos de inactividad sin perder sesion (via refresh continuo mientras el navegador esta abierto)

**Non-Goals:**
- Refresh proactivo por timer (solo reactivo + en init)
- Migrar otros componentes a apiClient (solo UsersTable en este change)
- Autenticacion del WebSocket (SocketContext no usa JWT actualmente)
- httpOnly cookies (usamos localStorage, mas simple)
- Manejo de multiples pestanas compartiendo sesion (cada pestana tiene su propio localStorage y refresh independiente, el servidor rota tokens -- la primera pestana que refreshea invalida el refresh token de las otras, que tendran que re-login. Trade-off aceptado para MVP)

## Decisions

### 1. localStorage keys y estructura

```
localStorage:
  'auth_access_token'   -> string (JWT access token)
  'auth_refresh_token'  -> string (refresh token raw)
  'auth_user'           -> JSON string (User object)
```

Alternativa: una sola key con JSON `{ accessToken, refreshToken, user }`. Descartada: queremos granularidad para leer solo lo necesario (ej: refresh en init solo necesita `refreshToken`, no parsear todo).

### 2. Init refresh con flag de carga

`AuthProvider` necesita un estado de "cargando" mientras intenta el refresh inicial, porque `RequireAuth` no debe redirigir prematuramente a `/login`.

```typescript
// AuthState agrega:
isLoading: boolean;  // true mientras se intenta refresh en init
```

Flujo en `RequireAuth`:
```
if (isLoading) -> spinner/null (no redirigir aun)
if (!isAuthenticated) -> /login
render children
```

Alternativa: mostrar children inmediatamente y que cada pagina maneje loading. Descartada: RequireAuth es el guardian natural, debe esperar.

### 3. Refresh reactivo con cola de requests

Cuando multiples requests concurrentes reciben 401 casi al mismo tiempo (ej: UsersTable fetchea users + una accion de toggle), solo UNO debe disparar el refresh. Los demas deben esperar.

```typescript
// apiClient interno:
let refreshPromise: Promise<void> | null = null;

async function refreshToken(): Promise<void> {
  if (refreshPromise) return refreshPromise;  // deduplicar
  refreshPromise = doRefresh();
  try { await refreshPromise; } finally { refreshPromise = null; }
}
```

Esto evita N llamadas concurrentes a `/api/auth/refresh` que provocarian que N-1 fallen (porque la primera rota el token y las otras usan el viejo ya revocado).

### 4. apiClient como modulo, no como contexto

`apiClient.ts` es un modulo simple que recibe callbacks de `AuthContext` para romper la dependencia circular:

```typescript
// apiClient.ts
let getToken: () => string | null;
let onRefresh: () => Promise<string | null>;  // devuelve nuevo accessToken o null
let onLogout: () => void;

export function configureApiClient(config: {
  getToken: () => string | null;
  onRefresh: () => Promise<string | null>;
  onLogout: () => void;
}) { ... }
```

`AuthProvider` llama `configureApiClient()` con sus callbacks al montarse. Esto rompe la dependencia circular limpiamente.

### 5. Formato de respuesta de apiClient

```typescript
// apiClient siempre devuelve { data, status } o throw
interface ApiResponse<T> {
  data: T;
  status: number;
}

function get<T>(url: string): Promise<ApiResponse<T>>;
function post<T>(url: string, body?: unknown): Promise<ApiResponse<T>>;
function patch<T>(url: string, body?: unknown): Promise<ApiResponse<T>>;
```

Errores de red, 401 irrecuperable, y otros errores HTTP lanzan excepcion. El componente decide como manejarlos.

## Risks / Trade-offs

- **[localStorage XSS]**: Si hay XSS en la app, el atacante puede leer el token. -> Mitigacion: es un dashboard interno, no una app publica. Si en el futuro se requiere mas seguridad, se migra a httpOnly cookies (requiere cambios en servidor).
- **[Race condition multi-pestana]**: Dos pestanas comparten el mismo refresh token en localStorage. Cuando una refreshea, la otra tiene un refresh token revocado. La segunda pestana hara logout en su proximo 401. -> Trade-off aceptado. En la practica, operadores usan una sola pestana.
- **[localStorage sincronico]**: `localStorage.getItem()` es sincronico y bloquea el main thread. -> Impacto insignificante (es una lectura de ~500 bytes, microsegundos).
- **[AuthProvider mounting delay]**: El refresh inicial agrega una llamada HTTP al montar. -> Agregamos `isLoading` state y RequireAuth muestra un spinner hasta que termine.
