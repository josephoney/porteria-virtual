## MODIFIED Requirements

### Requirement: LoginPage with shadcn-ui
The LoginPage SHALL use shadcn-ui Card, Input, Label, Button, and Alert components.

#### Scenario: Form container uses Card
- **WHEN** the login page renders
- **THEN** the form is wrapped in a `<Card>` component with consistent padding and shadow
- **THEN** the brand title and subtitle are in `<CardHeader>`

#### Scenario: Form fields use Input and Label
- **WHEN** the email and password fields render
- **THEN** they use `<Input>` with type email/password from shadcn-ui
- **THEN** each field has an associated `<Label>` for accessibility

#### Scenario: Submit button uses Button with loading
- **WHEN** the login form is submitted
- **THEN** the submit button uses `<Button>` with `loading` state showing a spinner
- **THEN** the button text changes to "Ingresando..." during submission

#### Scenario: Error message uses Alert
- **WHEN** login fails with invalid credentials
- **THEN** the error is displayed using `<Alert variant="destructive">` with an icon
- **THEN** the alert is styled consistently with the design system's red/error color

### Requirement: Sidebar badges with shadcn
The Sidebar SHALL use shadcn Badge for the role indicator.

#### Scenario: Role badge uses Badge
- **WHEN** the sidebar renders the operator's role
- **THEN** it uses `<Badge>` from shadcn-ui with the appropriate variant
- **THEN** the badge matches the existing size and position

### Requirement: TopBar button with shadcn
The TopBar SHALL use shadcn Button for the logout action.

#### Scenario: Logout uses Button
- **WHEN** the logout button renders
- **THEN** it uses `<Button variant="ghost">` from shadcn-ui with white text for dark background
- **THEN** it has consistent hover and focus states
