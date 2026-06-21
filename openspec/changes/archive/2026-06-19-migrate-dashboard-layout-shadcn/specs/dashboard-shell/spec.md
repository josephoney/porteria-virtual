## MODIFIED Requirements

### Requirement: Dashboard layout
The dashboard SHALL use shadcn Sidebar* components for its shell instead of CSS Grid.

#### Scenario: Layout uses SidebarProvider
- **WHEN** the dashboard app loads and user is authenticated
- **THEN** the layout is wrapped in `<SidebarProvider>`
- **THEN** the `<AppSidebar>` renders on the left
- **THEN** the main content renders inside `<SidebarInset>`

#### Scenario: TopBar integrated into SidebarInset
- **WHEN** the dashboard renders
- **THEN** the TopBar is inside `<SidebarInset>` as a `<header>` element
- **THEN** it includes `<SidebarTrigger>` for toggling the sidebar
- **THEN** it shows the brand, user name, RingtoneSelector, and logout button

#### Scenario: Sidebar navigation by role preserved
- **WHEN** user role is `admin`
- **THEN** sidebar shows: Operador, Admin, Guardia
- **WHEN** user role is `operator`
- **THEN** sidebar shows: Operador
- **WHEN** user role is `guard`
- **THEN** sidebar shows: Guardia
