## ADDED Requirements

### Requirement: SidebarProvider wraps the layout
The dashboard SHALL wrap its layout in `<SidebarProvider>` to manage sidebar open/collapsed state.

#### Scenario: Default state is expanded on desktop
- **WHEN** the dashboard loads on a screen >= 768px
- **THEN** the sidebar is expanded showing full labels and icons

#### Scenario: Collapsed on mobile
- **WHEN** the dashboard loads on a screen < 768px
- **THEN** the sidebar is hidden and accessible via hamburger menu

### Requirement: AppSidebar component
An `AppSidebar` component SHALL render navigation items using shadcn sidebar primitives.

#### Scenario: Navigation items with icons
- **WHEN** the sidebar renders
- **THEN** each navigation item shows a lucide-react icon and label
- **THEN** items are filtered by user role (admin sees Operador, Admin, Guardia; operator sees Operador)

#### Scenario: Active item highlighted
- **WHEN** the user is on a route matching a sidebar item
- **THEN** that item has `variant="default"` (filled background)

#### Scenario: Collapsed mode shows tooltips
- **WHEN** the sidebar is collapsed
- **THEN** hovering an icon-only item shows a tooltip with the label

### Requirement: SidebarInset for main content
The main content area SHALL be wrapped in `<SidebarInset>` for proper layout with the sidebar.

#### Scenario: TopBar inside SidebarInset
- **WHEN** the dashboard renders
- **THEN** the TopBar is inside `<SidebarInset>` with `<SidebarTrigger>` for toggle

### Requirement: Mobile sidebar via Sheet
On mobile devices, the sidebar SHALL render as a Sheet (drawer) overlay.

#### Scenario: Sheet opens on hamburger tap
- **WHEN** the user taps the hamburger menu on mobile
- **THEN** the sidebar slides in from the left as a Sheet overlay
- **THEN** tapping the backdrop closes it
