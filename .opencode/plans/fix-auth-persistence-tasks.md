## 1. AuthContext: localStorage persistence

- [ ] 1.1 Add `STORAGE_KEYS` constants (`auth_access_token`, `auth_refresh_token`, `auth_user`)
- [ ] 1.2 Add `isLoading` state (initialized `true`)
- [ ] 1.3 Implement `persistAuth(accessToken, refreshToken, user)` helper that writes all 3 to localStorage
- [ ] 1.4 Implement `clearPersistedAuth()` helper that removes all 3 from localStorage
- [ ] 1.5 Update `login()` to call `persistAuth(data.accessToken, data.refreshToken, data.user)` after successful login
- [ ] 1.6 Update `logout()` to call `POST /api/auth/logout`, then `clearPersistedAuth()`, then clear state

## 2. AuthContext: session recovery on init

- [ ] 2.1 Add `useEffect` on mount that reads `auth_refresh_token` from localStorage
- [ ] 2.2 If refresh token exists, call `POST /api/auth/refresh` with it
- [ ] 2.3 On refresh success: call `persistAuth()` with new tokens, restore `user` from `auth_user` localStorage, set state
- [ ] 2.4 On refresh failure: call `clearPersistedAuth()`, leave state empty
- [ ] 2.5 Set `isLoading` to `false` in all cases (success, failure, no token)
- [ ] 2.6 Expose `isLoading` in context value + `AuthState` interface

## 3. RequireAuth: loading state

- [ ] 3.1 Read `isLoading` from `useAuth()`
- [ ] 3.2 When `isLoading` is true, render loading indicator (spinner or null) instead of redirecting to `/login`
- [ ] 3.3 When `isLoading` is false and not authenticated, redirect to `/login` (existing behavior)

## 4. apiClient module

- [ ] 4.1 Create `apps/dashboard/src/lib/apiClient.ts`
- [ ] 4.2 Define `ApiResponse<T>` interface with `{ data: T; status: number }`
- [ ] 4.3 Implement `configureApiClient(config)` to receive `getToken`, `onRefresh`, `onLogout` callbacks
- [ ] 4.4 Implement internal `request(method, url, body?)` that attaches `Authorization` header from `getToken()`
- [ ] 4.5 Implement internal `doRefresh()` that: deduplicates concurrent refreshes, calls `onRefresh()`, retries original request on success, calls `onLogout()` on failure
- [ ] 4.6 Export `get<T>(url)`, `post<T>(url, body?)`, `patch<T>(url, body?)` functions
- [ ] 4.7 Handle non-JSON responses gracefully (network errors, CORS errors)

## 5. AuthContext: wire apiClient

- [ ] 5.1 Add `useEffect` to call `configureApiClient({ getToken, onRefresh, onLogout })` on mount
- [ ] 5.2 Implement `getToken`: returns `token` from state (falls back to localStorage as belt-and-suspenders)
- [ ] 5.3 Implement `onRefresh`: calls `POST /api/auth/refresh` with refresh token from localStorage, on success updates state + localStorage, returns new accessToken
- [ ] 5.4 Implement `onLogout`: clears localStorage and state

## 6. UsersTable: migrate to apiClient

- [ ] 6.1 Import `apiClient` instead of using raw `fetch` with manual headers
- [ ] 6.2 Replace `fetchUsers()`: use `apiClient.get()` instead of `fetch()` + manual `Authorization` header
- [ ] 6.3 Replace `handleCreate()`: use `apiClient.post()` 
- [ ] 6.4 Replace `handleToggleActive()`: use `apiClient.patch()`
- [ ] 6.5 Replace `handleRoleChange()`: use `apiClient.patch()`
- [ ] 6.6 Remove `token` from `useAuth()` destructuring (no longer needed directly)
- [ ] 6.7 Remove `CONFIG.API_URL` import (apiClient already knows the base URL)

## 7. Verification

- [ ] 7.1 Login, reload page: verify session persists (no redirect to /login)
- [ ] 7.2 Wait 15+ minutes, perform action: verify 401 triggers refresh and action succeeds
- [ ] 7.3 Logout: verify localStorage is cleared, verify redirect to /login
- [ ] 7.4 Login in tab A, login in tab B, refresh tab A: verify tab B eventually logs out (race condition)
- [ ] 7.5 Clear localStorage manually, reload: verify redirect to /login
- [ ] 7.6 Verify UsersTable CRUD operations work correctly through apiClient
