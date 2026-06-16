## ADDED Requirements

### Requirement: Ringtone selector UI
The operator panel header SHALL include a ringtone selector dropdown that allows choosing and previewing ringtones.

#### Scenario: Selector renders with current ringtone
- **WHEN** the operator panel loads
- **THEN** a `<select>` dropdown is rendered in the panel main header
- **THEN** the currently selected ringtone is shown as the selected option

#### Scenario: Changing ringtone saves and previews
- **WHEN** the operator selects a different ringtone from the dropdown
- **THEN** the selection is persisted to localStorage
- **THEN** a preview of the selected ringtone plays once

#### Scenario: Selector hidden for guard role
- **WHEN** a user with role 'guard' views the dashboard
- **THEN** the ringtone selector is not rendered
