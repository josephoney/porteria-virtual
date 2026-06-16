## Why

Cada recarga de pagina destruye la sesion del usuario porque el JWT solo existe en `useState` de React (memoria volatil). El servidor ya implementa refresh tokens con rotacion, pero el cliente descarta el `refreshToken` que el login devuelve. Tampoco hay un cliente HTTP centralizado: cada componente repite manualmente el header `Authorization: Bearer ${token}` y nadie maneja los 401 con refresh automatico. A los 15 minutos (expiracion del access token) todo falla silenciosamente.

Esto hace el dashboard inusable en produccion: cualquier F5, cualquier pestana nueva, o cualquier pausa de 15 minutos fuerza un re-login.

## What Changes

- **Persistencia en localStorage**: El `accessToken`, `refreshToken` y `user` se persisten en localStorage al hacer login, y se leen al inicializar `AuthProvider`
- **Refresh automatico al iniciar**: Si hay un `refreshToken` en localStorage, se intenta renovar la sesion al montar el contexto (antes de renderizar rutas protegidas)
- **Refresh reactivo ante 401**: Si una API responde 401, automaticamente se intenta refresh con el token guardado. Si falla, logout
- **Logout completo**: `logout()` ahora llama a `POST /api/auth/logout` para revocar el refresh token en el servidor, y limpia localStorage
- **Cliente HTTP centralizado (`apiClient`)**: Nuevo modulo `lib/apiClient.ts` con metodos `get`/`post`/`patch` que automaticamente adjuntan el `Authorization` header y manejan 401 con refresh-transparente
- **UsersTable migrado a apiClient**: Reemplaza los 4 `fetch()` manuales por llamadas a `apiClient`

## Capabilities

### Modified Capabilities
- `jwt-auth`: El requirement de login ahora incluye persistencia en cliente. Logout incluye revocacion server-side. Se agrega el flujo de refresh automatico en cliente.

## Impact

- `apps/dashboard/src/contexts/AuthContext.tsx`: Refactor completo (~100 lineas) -- localStorage, refresh en init, logout server-side
- `apps/dashboard/src/lib/apiClient.ts`: Nuevo (~60 lineas) -- fetch wrapper con auth + 401 interceptor
- `apps/dashboard/src/components/admin/UsersTable.tsx`: Migracion a apiClient (~20 lineas cambiadas)
- `apps/dashboard/src/pages/LoginPage.tsx`: Sin cambios (la interfaz de `login()` no cambia)
- CERO cambios en servidor, DTOs, DB, o rutas
