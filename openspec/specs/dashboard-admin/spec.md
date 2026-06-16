# Dashboard Admin Panel

## Purpose

Provides the admin panel within the dashboard: user management with paginated listing, create/edit user forms, role management, and active status toggling. All operations go through the REST API with JWT authentication.

## ADDED Requirements

### Requirement: Users list
The admin SHALL see a paginated table of all users in their organization.

#### Scenario: Users table rendered
- **WHEN** the admin navigates to `/admin`
- **THEN** a table displays users with columns: Email, Name, Role, Active, Actions
- **THEN** pagination controls are shown if total > page size

#### Scenario: Role badges
- **WHEN** users are displayed
- **THEN** each role has a distinct badge color: admin=dark, operator=blue, guard=amber, resident=green

### Requirement: Create user
The admin SHALL be able to create new users via a form.

#### Scenario: Create user form
- **WHEN** the admin clicks "Nuevo Usuario"
- **THEN** a form appears with fields: Email, Name, Password, Role
- **THEN** on submit, POST /api/users is called with the JWT token

#### Scenario: Create user success
- **WHEN** the API returns 201
- **THEN** the user appears in the table
- **THEN** the form resets

#### Scenario: Create user error
- **WHEN** the API returns 409 (duplicate email)
- **THEN** an error message "El email ya está en uso" is shown

### Requirement: Edit user
The admin SHALL be able to edit user role and active status.

#### Scenario: Toggle active status
- **WHEN** the admin toggles the active switch
- **THEN** PATCH /api/users/:id is called with `{ active: true/false }`
- **THEN** the row updates without page reload

#### Scenario: Change role
- **WHEN** the admin selects a new role from the dropdown
- **THEN** PATCH /api/users/:id is called with `{ role }`
- **THEN** the badge updates immediately

### Requirement: Admin panel design consistency
The admin panel SHALL follow the same visual design as the operator panel.

#### Scenario: Same design system
- **WHEN** the admin panel is rendered
- **THEN** it uses the same color scheme (#f5f4ef background, #1a1916 text)
- **THEN** it uses the same font families (Syne for headings, IBM Plex Mono for data)
- **THEN** buttons and inputs follow the same style
