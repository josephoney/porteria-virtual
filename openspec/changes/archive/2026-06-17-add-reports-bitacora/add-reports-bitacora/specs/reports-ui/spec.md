## ADDED Requirements

### Requirement: Reports panel in admin dashboard
The dashboard SHALL provide a "Reportes" section accessible to admin users with period selectors and visualizations.

#### Scenario: Reports panel navigation
- **WHEN** an admin user navigates to the Admin section
- **THEN** a "Reportes" tab or subsection is visible next to "Usuarios" and "Historial"
- **THEN** switching to the tab renders the reports panel

#### Scenario: Period selector
- **WHEN** the reports panel is loaded
- **THEN** a period selector is visible with options: Diario, Semanal, Mensual
- **THEN** selecting a period type shows a date/week/month picker

#### Scenario: Daily report visualization
- **WHEN** an admin selects "Diario" and picks a date
- **THEN** a bar chart shows calls by hour for that day
- **THEN** summary cards show: total calls, answered, missed, doors opened

#### Scenario: Weekly report visualization
- **WHEN** an admin selects "Semanal" and picks a week
- **THEN** a line chart shows daily call trends across the 7 days
- **THEN** a summary table shows per-day breakdown

#### Scenario: Monthly report visualization
- **WHEN** an admin selects "Mensual" and picks a month
- **THEN** a line/bar chart shows weekly aggregates
- **THEN** totals are displayed in summary cards

#### Scenario: Chart uses design system tokens
- **WHEN** any chart is rendered
- **THEN** colors, typography, and spacing match the existing design system: background `#f5f4ef`, text `#1a1916`, accent colors consistent with status badges

### Requirement: Bitácora view in admin dashboard
The dashboard SHALL provide a full bitácora (event log) view with filters and pagination.

#### Scenario: Bitácora page
- **WHEN** an admin navigates to the bitácora section
- **THEN** a paginated table displays events fetched from `GET /api/events`
- **THEN** columns show: Fecha/Hora, Tipo de Evento, Actor, Access Point, Detalle

#### Scenario: Event type filter
- **WHEN** an admin selects a filter "Tipo de Evento" and picks "door.open"
- **THEN** only events with that type are displayed

#### Scenario: Date range filter
- **WHEN** an admin enters "Desde" and "Hasta" dates
- **THEN** only events within that range are displayed

#### Scenario: Event detail expansion
- **WHEN** an admin clicks on an event row
- **THEN** the row expands to show the full metadata JSON with formatted key-value pairs

#### Scenario: Bitácora pagination
- **WHEN** there are more than 20 events
- **THEN** pagination controls appear with page numbers and total count

#### Scenario: Empty state
- **WHEN** no events match the current filters
- **THEN** a message "No se encontraron eventos" is displayed

### Requirement: Operator bitácora link
The operator EventLog SHALL provide a link to the full bitácora view.

#### Scenario: Link to full bitácora
- **WHEN** an operator views the EventLog in their panel
- **THEN** a "Ver bitácora completa" link is visible
- **THEN** clicking it navigates to the admin bitácora view
