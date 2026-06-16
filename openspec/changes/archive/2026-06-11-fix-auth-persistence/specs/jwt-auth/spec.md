## MODIFIED Requirements

### Requirement: Login endpoint (client-side persistence)

> Modifies: jwt-auth spec - Login endpoint requirement

The client SHALL persist the authentication tokens and user data to localStorage upon successful login.

#### Scenario: Successful login persists tokens
- **WHEN** a login request succeeds with `{ accessToken, refreshToken, user }`
- **THEN** `localStorage.setItem('auth_access_token', accessToken)` is called
- **THEN** `localStorage.setItem('auth_refresh_token', refreshToken)` is called
- **THEN** `localStorage.setItem('auth_user', JSON.stringify(user))` is called
- **THEN** React state `token` and `user` are set

#### Scenario: Refresh token is stored for later use
- **WHEN** login succeeds
- **THEN** the refresh token is available via `localStorage.getItem('auth_refresh_token')`
- **THEN** subsequent API calls that receive 401 can use it to obtain a new access token

### Requirement: Session recovery on page reload (NEW)

The client SHALL attempt to recover the authenticated session from localStorage when the application initializes.

#### Scenario: Valid refresh token on init
- **WHEN** the AuthProvider mounts and `localStorage` contains `auth_refresh_token`
- **THEN** a POST request is made to `/api/auth/refresh` with the stored refresh token
- **THEN** if the response is successful, the new `accessToken` and `refreshToken` are stored in localStorage and React state
- **THEN** the user from `auth_user` is restored to React state
- **THEN** `isLoading` transitions from `true` to `false`

#### Scenario: Expired or revoked refresh token on init
- **WHEN** the refresh request fails (401)
- **THEN** all auth keys are removed from localStorage
- **THEN** React state remains empty (token = null, user = null)
- **THEN** `isLoading` transitions to `false`
- **THEN** `RequireAuth` redirects to `/login`

#### Scenario: No stored tokens on init
- **WHEN** localStorage contains no auth keys
- **THEN** `isLoading` immediately transitions to `false`
- **THEN** `RequireAuth` redirects to `/login`

#### Scenario: Loading state blocks premature redirect
- **WHEN** AuthProvider is initializing (isLoading = true)
- **THEN** `RequireAuth` does NOT redirect to `/login`
- **THEN** `RequireAuth` renders a loading indicator or null

### Requirement: Logout endpoint (client-side)

> Modifies: jwt-auth spec - Logout endpoint requirement

The client SHALL revoke the refresh token server-side on logout and clear all persisted auth state.

#### Scenario: Successful logout
- **WHEN** an authenticated user triggers logout
- **THEN** a POST request is made to `/api/auth/logout` with the stored refresh token
- **THEN** `localStorage.removeItem()` is called for all auth keys (`auth_access_token`, `auth_refresh_token`, `auth_user`)
- **THEN** React state `token` and `user` are set to `null`
- **THEN** the user is redirected to `/login`

#### Scenario: Logout handles network failure gracefully
- **WHEN** the POST to `/api/auth/logout` fails (network error)
- **THEN** localStorage is STILL cleared
- **THEN** React state is STILL cleared
- **THEN** the user is still redirected to `/login`

### Requirement: Automatic token refresh on 401 (NEW)

The client SHALL automatically attempt to refresh the access token when an authenticated API request returns 401.

#### Scenario: Single 401 triggers refresh and retry
- **WHEN** an authenticated API request receives a 401 response
- **THEN** a POST request is made to `/api/auth/refresh` with the stored refresh token
- **THEN** if refresh succeeds, the new tokens are stored in localStorage and React state
- **THEN** the original failed request is retried with the new access token
- **THEN** the retry response is returned to the caller

#### Scenario: Concurrent 401s share a single refresh
- **WHEN** multiple API requests receive 401 simultaneously
- **THEN** only ONE POST to `/api/auth/refresh` is made
- **THEN** all other requests await the same refresh promise
- **THEN** after successful refresh, all requests retry with the new token

#### Scenario: Refresh failure triggers logout
- **WHEN** a 401-triggered refresh request also fails (401)
- **THEN** `logout()` is called (clear localStorage, clear state, revoke server-side)
- **THEN** the user is redirected to `/login`

### Requirement: Centralized API client (NEW)

The dashboard SHALL have a centralized HTTP client module that all authenticated API calls use.

#### Scenario: apiClient attaches auth header
- **WHEN** `apiClient.get()` or `apiClient.post()` or `apiClient.patch()` is called
- **THEN** the request includes `Authorization: Bearer <accessToken>` header
- **THEN** the request includes `Content-Type: application/json` header for POST/PATCH

#### Scenario: apiClient handles 401 with refresh
- **WHEN** an apiClient request receives 401
- **THEN** it automatically attempts token refresh and retries the request
- **THEN** the caller receives the retry response without knowing about the refresh

#### Scenario: apiClient throws on non-401 errors
- **WHEN** an apiClient request receives an HTTP error that is not 401
- **THEN** an error is thrown with the response status and body
