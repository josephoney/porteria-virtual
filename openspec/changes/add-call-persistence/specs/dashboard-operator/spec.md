## ADDED Requirements

### Requirement: Operator call history
The operator panel SHALL include a section showing the operator's recent call history.

#### Scenario: Recent calls displayed
- **WHEN** the operator panel loads
- **THEN** a collapsible "Mis llamadas" section is displayed
- **THEN** it shows up to 50 most recent calls where `operatorId` matches the operator's user ID
- **THEN** calls are fetched via `GET /api/calls?operatorId=<id>&pageSize=50`

#### Scenario: Call list shows relevant info
- **WHEN** the operator's call history is displayed
- **THEN** each row shows: kiosk name, start time (HH:MM format), and status (Atendida/Perdida)
- **THEN** calls are ordered by most recent first

#### Scenario: Empty history
- **WHEN** the operator has no call history
- **THEN** a message "Aún no has atendido llamadas" is displayed

#### Scenario: Section is collapsible
- **WHEN** the operator clicks the "Mis llamadas" header
- **THEN** the call list toggles between visible and hidden
- **THEN** the toggle state is preserved during the session (React state, not localStorage)

#### Scenario: History refreshes periodically
- **WHEN** the operator completes a call
- **THEN** the history refreshes to include the new call
- **THEN** a polling interval of 60 seconds keeps the list updated
