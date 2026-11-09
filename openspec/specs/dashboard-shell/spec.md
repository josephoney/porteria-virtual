# Dashboard Shell

## Purpose

Provides the layout shell (TopBar + Sidebar + content area) for the dashboard SPA with role-based navigation, JWT authentication via login page, and route protection by user role.
## Requirements
### Requirement: Dashboard layout
The dashboard SHALL have a shell with TopBar, Sidebar, and a main content area using
React Router.

#### Scenario: Layout renders with outlet
- **WHEN** the dashboard app loads and user is authenticated
- **THEN** the TopBar is displayed with the brand
- **THEN** the Sidebar shows navigation items based on the active role
- **THEN** the main content area renders the active route

#### Scenario: Sidebar items by role
- **WHEN** the active role is `org_admin`
- **THEN** the sidebar shows Operador, Admin, and Guardia
- **WHEN** the active role is `community_admin`
- **THEN** the sidebar shows Operador and Admin
- **WHEN** the active role is `operator`
- **THEN** the sidebar shows Operador
- **WHEN** the active role is `guard`
- **THEN** the sidebar shows Guardia
- **WHEN** the active context is platform
- **THEN** the sidebar shows only Plataforma and hides tenant items

### Requirement: Login page
The dashboard SHALL have a login page that authenticates against the API and stores the JWT token.

#### Scenario: Successful login
- **WHEN** user enters valid email and password
- **THEN** the app POSTs to `/api/auth/login` and receives JWT + user data
- **THEN** the user is redirected to the dashboard

#### Scenario: Failed login
- **WHEN** user enters invalid credentials
- **THEN** an error message "Email o contraseña inválidos" is displayed

### Requirement: Role-based route protection
The dashboard SHALL restrict routes based on the active role and context.

#### Scenario: Admin accesses admin page
- **WHEN** an `org_admin` or `community_admin` navigates to `/admin`
- **THEN** the admin panel is displayed

#### Scenario: Operator cannot access admin page
- **WHEN** an `operator` navigates to `/admin`
- **THEN** they are redirected to the operator panel at `/`

#### Scenario: Resident is redirected
- **WHEN** a user with an `owner`, `tenant`, or `resident` membership opens `/` or
  `/admin`
- **THEN** they are redirected to `/app-required`

#### Scenario: Platform context is redirected
- **WHEN** a platform admin without a tenant context opens `/` or a tenant route
- **THEN** they are redirected to `/platform`

### Requirement: TopBar with user info
The TopBar SHALL display total kiosks count, active calls count, and current user name.

#### Scenario: TopBar stats
- **WHEN** the dashboard is loaded and connected to signaling
- **THEN** the TopBar shows "Kiosks: N" and "Llamadas activas: M"
- **THEN** a user badge shows the operator name

