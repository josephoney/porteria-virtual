## MODIFIED Requirements

### Requirement: UsersTable with shadcn-ui
The UsersTable SHALL use shadcn-ui Table, Select, Input, Button, Badge, and Dialog components instead of vanilla HTML elements with inline styles.

#### Scenario: Table uses shadcn Table
- **WHEN** the UsersTable renders
- **THEN** it uses `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableCell>`, `<TableHead>` from shadcn-ui
- **THEN** rows have hover states and consistent spacing
- **THEN** status badges use `<Badge>` component

#### Scenario: Role selector uses shadcn Select
- **WHEN** an admin changes a user's role via the inline dropdown
- **THEN** it uses `<Select>` from shadcn-ui with proper keyboard navigation

#### Scenario: User creation form uses Dialog
- **WHEN** an admin clicks "Nuevo Usuario"
- **THEN** a `<Dialog>` opens with the creation form
- **THEN** form fields use `<Input>` and `<Label>` from shadcn-ui
- **THEN** the submit button uses `<Button>` with loading state

#### Scenario: Toggle active uses shadcn Button
- **WHEN** an admin toggles a user's active state
- **THEN** the toggle uses `<Button variant="ghost">` or `<Button variant="outline">`

### Requirement: CallHistoryTable with shadcn-ui
The CallHistoryTable SHALL use shadcn-ui Table, Select, Button, and Badge components.

#### Scenario: Table uses shadcn Table
- **WHEN** the CallHistoryTable renders
- **THEN** it uses shadcn Table components for the call history list
- **THEN** status badges use `<Badge>` with appropriate variants

#### Scenario: Filters use shadcn components
- **WHEN** the status filter and date inputs render
- **THEN** the status filter uses `<Select>` from shadcn-ui
- **THEN** date inputs use standard `<Input type="date">` with shadcn styling

### Requirement: BitacoraView with shadcn-ui
The BitacoraView SHALL use shadcn-ui Table, Badge, Select, and Collapsible components.

#### Scenario: Table uses shadcn Table
- **WHEN** the BitacoraView renders
- **THEN** the event list uses shadcn Table components
- **THEN** event type badges use `<Badge>` with variant mapped to event type

#### Scenario: Expandable metadata uses Collapsible
- **WHEN** a user clicks an event row to see metadata
- **THEN** the metadata JSON expands using Radix Collapsible (via shadcn)
- **THEN** the expanded content shows formatted JSON in a `<pre>` block

#### Scenario: Loading state uses Skeleton
- **WHEN** events are being fetched
- **THEN** the table shows `<Skeleton>` rows instead of "Cargando..." text

### Requirement: ReportsPanel with shadcn-ui
The ReportsPanel SHALL use shadcn-ui Tabs, Card, and Button components.

#### Scenario: Period selector uses Tabs
- **WHEN** the ReportsPanel renders
- **THEN** the diario/semanal/mensual selector uses `<Tabs>` with `<TabsList>` and `<TabsTrigger>`
- **THEN** the active tab has proper visual indicator

#### Scenario: MetricCards use Card
- **WHEN** summary metrics render
- **THEN** each metric card uses `<Card>` with `<CardHeader>` and `<CardContent>`
- **THEN** the styling is consistent with the design system

#### Scenario: Load button uses Button
- **WHEN** the "Cargar" button renders
- **THEN** it uses `<Button>` from shadcn-ui with loading state during fetch
