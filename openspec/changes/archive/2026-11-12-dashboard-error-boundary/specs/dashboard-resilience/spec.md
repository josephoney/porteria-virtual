## ADDED Requirements

### Requirement: Error fallback instead of a blank page

A render error inside a dashboard route MUST render a fallback instead of unmounting the whole application.

#### Scenario: Route content throws

- **WHEN** a component rendered by the route outlet throws during render
- **THEN** the fallback shows the title “Algo salió mal”
- **THEN** the sidebar and the header remain rendered
- **THEN** the user can navigate to another section without reloading

#### Scenario: Shell throws

- **WHEN** a component outside the route outlet throws, such as the sidebar or the header
- **THEN** a full-page fallback is shown with the same content and actions

#### Scenario: Login and public routes

- **WHEN** a public page such as `/login`, `/invite/:token` or `/c/:slug` throws
- **THEN** the full-page fallback is shown

### Requirement: Error actions

The fallback MUST offer a retry action and a reload action.

#### Scenario: Retry

- **WHEN** the user selects “Reintentar”
- **THEN** the boundary clears its error state and renders the route again

#### Scenario: Reload

- **WHEN** the user selects “Recargar”
- **THEN** the page reloads

### Requirement: Navigation clears the error

Changing the route MUST clear a previous render error.

#### Scenario: Navigate after an error

- **WHEN** the fallback is visible and the user navigates to another route
- **THEN** the new route renders normally
- **THEN** the fallback is no longer shown

### Requirement: Technical detail limited to development

The fallback MUST NOT expose the stack trace in production builds.

#### Scenario: Development build

- **WHEN** the app runs in development and an error occurs
- **THEN** the fallback shows the error message and the stack
- **THEN** the error is logged to the browser console with the component stack

#### Scenario: Production build

- **WHEN** the app runs in production and an error occurs
- **THEN** the fallback shows the error message without the stack
- **THEN** the error is still logged to the browser console
