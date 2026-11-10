## ADDED Requirements

### Requirement: Push permission and token (Phase 2)

The app SHALL register for push notifications.

#### Scenario: Reserved in MVP

- **WHEN** the MVP runs
- **THEN** the app does not request notification permission
- **THEN** no push token is registered

#### Scenario: Permission granted

- **WHEN** the user grants notification permission
- **THEN** the app obtains the Expo Push Token and registers it with
  `POST /api/me/push-devices` using `platform = 'expo'`

#### Scenario: Permission denied

- **WHEN** the user denies permission
- **THEN** the app continues working and shows notifications only in-app

#### Scenario: Token refresh

- **WHEN** Expo rotates the token
- **THEN** the app registers the new token and deactivates the old one

### Requirement: Notification list (Phase 2)

The app SHALL show the resident's notifications.

#### Scenario: List

- **WHEN** the resident opens the notifications screen
- **THEN** the app lists notifications ordered by date with read/unread state

#### Scenario: Mark as read

- **WHEN** the user opens a notification
- **THEN** the app marks it as read

#### Scenario: Unread badge

- **WHEN** there are unread notifications
- **THEN** the app shows a badge on the notifications tab

### Requirement: Pass notifications (Phase 2)

The app SHALL display pass entry/exit/rejection/missing-exit notifications.

#### Scenario: Entry

- **WHEN** a pass entry is confirmed
- **THEN** the resident receives an in-app/push notification with the visitor name and
  plate if present

#### Scenario: Missing exit

- **WHEN** a missing-exit alert is created
- **THEN** the resident receives a notification with the pass and time

### Requirement: Deep links (Phase 2)

Notifications SHALL open the related screen.

#### Scenario: Pass notification

- **WHEN** the user taps a pass notification
- **THEN** the app opens the pass detail

#### Scenario: Scan notification

- **WHEN** the user taps a scan notification
- **THEN** the app opens the scan or history screen
