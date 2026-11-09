## ADDED Requirements

### Requirement: Notification preferences

The system SHALL store per-user notification preferences by community, type, and
channel.

#### Scenario: Preference fields
- **WHEN** a preference is stored
- **THEN** it includes `user_id`, `community_id`, `type`, `channel`, `enabled`,
  `quiet_hours_start`, `quiet_hours_end`

#### Scenario: Default preferences
- **WHEN** a user has no explicit preference
- **THEN** defaults are applied by role and notification type

#### Scenario: Update preference
- **WHEN** a user updates a preference
- **THEN** the change applies to subsequent notifications

### Requirement: Quiet hours

Preferences SHALL support quiet hours.

#### Scenario: During quiet hours
- **WHEN** a notification is requested during quiet hours
- **THEN** push is suppressed
- **THEN** in-app is still stored

#### Scenario: After quiet hours
- **WHEN** quiet hours end
- **THEN** suppressed push notifications are coalesced into a summary or delivered
  according to policy

#### Scenario: Timezone
- **WHEN** quiet hours are evaluated
- **THEN** they use the user's community timezone

### Requirement: Critical notification types

Critical types SHALL ignore quiet hours and non-critical suppression.

#### Scenario: Panic alert
- **WHEN** a `panic_alert` notification is requested
- **THEN** it is delivered regardless of preferences
- **THEN** the event is audited

#### Scenario: Critical cannot be fully disabled
- **WHEN** a user attempts to disable `panic_alert`
- **THEN** the API rejects the change or forces the in-app channel on

### Requirement: Preference API

The API SHALL expose endpoints to read and update preferences.

#### Scenario: List preferences
- **WHEN** a user requests their preferences
- **THEN** the response includes explicit and defaulted preferences

#### Scenario: Update preferences
- **WHEN** a user updates a preference
- **THEN** the response returns the updated preference

#### Scenario: Invalid channel
- **WHEN** a preference uses an unsupported channel
- **THEN** the response has status 400
