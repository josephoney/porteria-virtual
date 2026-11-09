## ADDED Requirements

### Requirement: Push device registration

Users SHALL be able to register push tokens for their devices.

#### Scenario: Register token
- **WHEN** an authenticated user registers `{ platform, token, deviceName? }`
- **THEN** a `push_devices` row is created or updated for that user and token

#### Scenario: Register Expo token
- **WHEN** the Zima QR Access app registers an Expo push token with `platform = 'expo'`
- **THEN** the token is stored and used for Expo Push delivery

#### Scenario: Multiple devices
- **WHEN** a user registers a second device
- **THEN** both tokens remain active and receive notifications

#### Scenario: Duplicate token
- **WHEN** the same token is registered again
- **THEN** the existing row is updated instead of duplicated

### Requirement: Token lifecycle

The system SHALL handle token refresh and invalidation.

#### Scenario: Token rotation
- **WHEN** a client reports a new token for an existing device
- **THEN** the old token is deactivated and the new one is stored

#### Scenario: Invalid token from provider
- **WHEN** the push provider reports a token as invalid
- **THEN** the token is marked `invalid` and excluded from future sends

#### Scenario: Unregister device
- **WHEN** a user unregisters a token
- **THEN** the token is removed or marked inactive

### Requirement: Provider selection

The system SHALL select the push provider based on platform and configuration.

#### Scenario: Web push
- **WHEN** the token platform is `web`
- **THEN** the WebPush provider is used

#### Scenario: Mobile push
- **WHEN** the token platform is `android` or `ios`
- **THEN** the configured mobile provider (FCM/APNs) is used

#### Scenario: Expo push
- **WHEN** the token platform is `expo`
- **THEN** the Expo Push provider is used

#### Scenario: Unsupported platform
- **WHEN** a token is registered with an unsupported platform
- **THEN** the response has status 400

### Requirement: Cleanup job

The system SHALL periodically clean stale device tokens.

#### Scenario: Stale token
- **WHEN** a token has not been seen for the configured retention window
- **THEN** it is marked inactive

#### Scenario: Cleanup audit
- **WHEN** the cleanup job runs
- **THEN** it records the number of deactivated tokens
