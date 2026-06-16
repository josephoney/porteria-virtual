## 1. AuthContext: localStorage persistence

- [x] 1.1 Add `STORAGE_KEYS` constants (`auth_access_token`, `auth_refresh_token`, `auth_user`)
- [x] 1.2 Add `isLoading` state (initialized `true`)
- [x] 1.3 Implement `persistAuth(accessToken, refreshToken, user)` helper that writes all 3 to localStorage
- [x] 1.4 Implement `clearPersistedAuth()` helper that removes all 3 from localStorage
- [x] 1.5 Update `login()` to call `persistAuth(data.accessToken, data.refreshToken, data.user)` after successful login
- [x] 1.6 Update `logout()` to call `POST /api/auth/logout`, then `clearPersistedAuth()`, then clear state

## 2. AuthContext: session recovery on init

- [x] 2.1 Add `useEffect` on mount that reads `auth_refresh_token` from localStorage
- [x] 2.2 If refresh token exists, call `POST /api/auth/refresh` with it
- [x] 2.3 On refresh success: call `persistAuth()` with new tokens, restore `user` from `auth_user` localStorage, set state
- [x] 2.4 On refresh failure: call `clearPersistedAuth()`, leave state empty
- [x] 2.5 Set `isLoading` to `false` in all cases (success, failure, no token)
- [x] 2.6 Expose `isLoading` in context value + `AuthState` interface

## 3. RequireAuth: loading state

- [x] 3.1 Read `isLoading` from `useAuth()`
- [x] 3.2 When `isLoading` is true, render loading indicator (null) instead of redirecting to `/login`
- [x] 3.3 When `isLoading` is false and not authenticated, redirect to `/login` (existing behavior)

## 4. apiClient module

- [x] 4.1 Create `apps/dashboard/src/lib/apiClient.ts`
- [x] 4.2 Define `ApiResponse<T>` interface with `{ data: T; status: number }`
- [x] 4.3 Implement `configureApiClient(config)` to receive `getToken`, `onRefresh`, `onLogout` callbacks
- [x] 4.4 Implement internal `request(method, path, body?)` that attaches `Authorization` header from `getToken()`
- [x] 4.5 Implement internal refresh logic that: deduplicates concurrent refreshes, calls `onRefresh()`, retries original request on success, calls `onLogout()` on failure
- [x] 4.6 Export `get<T>(path)`, `post<T>(path, body?)`, `patch<T>(path, body?)` functions
- [x] 4.7 Handle non-JSON responses gracefully (network errors via try/catch)

## 5. AuthContext: wire apiClient

- [x] 5.1 Add `useEffect` to call `configureApiClient({ getToken, onRefresh, onLogout })` on mount
- [x] 5.2 Implement `getToken`: returns token from localStorage
- [x] 5.3 Implement `onRefresh`: calls `POST /api/auth/refresh` with refresh token from localStorage, on success updates state + localStorage, returns new accessToken
- [x] 5.4 Implement `onLogout`: clears localStorage and state

## 6. UsersTable: migrate to apiClient

- [x] 6.1 Import `apiClient` instead of using raw `fetch` with manual headers
- [x] 6.2 Replace `fetchUsers()`: use `get()` instead of `fetch()` + manual `Authorization` header
- [x] 6.3 Replace `handleCreate()`: use `post()`
- [x] 6.4 Replace `handleToggleActive()`: use `patch()`
- [x] 6.5 Replace `handleRoleChange()`: use `patch()`
- [x] 6.6 Remove `token` from `useAuth()` destructuring (no longer needed directly)
- [x] 6.7 Remove `CONFIG` import (apiClient already knows the base URL)

## 7. Verification

- [ ] 7.1 Login, reload page: verify session persists (no redirect to /login)
- [ ] 7.2 Wait 15+ minutes, perform action: verify 401 triggers refresh and action succeeds
- [ ] 7.3 Logout: verify localStorage is cleared, verify redirect to /login
- [ ] 7.4 Login in tab A, login in tab B, refresh tab A: verify tab B eventually logs out (race condition)
- [ ] 7.5 Clear localStorage manually, reload: verify redirect to /login
- [ ] 7.6 Verify UsersTable CRUD operations work correctly through apiClient
