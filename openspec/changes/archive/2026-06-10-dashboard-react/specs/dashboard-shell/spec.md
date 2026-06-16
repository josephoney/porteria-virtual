## ADDED Requirements

### Requirement: Dashboard layout
The dashboard SHALL have a shell with TopBar, Sidebar, and a main content area using React Router.

#### Scenario: Layout renders with outlet
- **WHEN** the dashboard app loads and user is authenticated
- **THEN** the TopBar is displayed with brand "PORTERÍA VIRTUAL — PANEL"
- **THEN** the Sidebar shows navigation items based on user role
- **THEN** the main content area renders the active route

#### Scenario: Sidebar items by role
- **WHEN** user role is `admin`
- **THEN** sidebar shows: Operador, Admin, Guardia
- **WHEN** user role is `operator`
- **THEN** sidebar shows: Operador
- **WHEN** user role is `guard`
- **THEN** sidebar shows: Guardia

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
The dashboard SHALL restrict routes based on user role.

#### Scenario: Admin accesses admin page
- **WHEN** an admin navigates to `/admin`
- **THEN** the admin panel is displayed

#### Scenario: Operator cannot access admin page
- **WHEN** an operator navigates to `/admin`
- **THEN** they are redirected to the operator panel

### Requirement: TopBar with user info
The TopBar SHALL display total kiosks count, active calls count, and current user name.

#### Scenario: TopBar stats
- **WHEN** the dashboard is loaded and connected to signaling
- **THEN** the TopBar shows "Kiosks: N" and "Llamadas activas: M"
- **THEN** a user badge shows the operator name
