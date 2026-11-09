## ADDED Requirements

### Requirement: Notification creation

The system SHALL create a persisted notification for every requested notification.

#### Scenario: Create notification
- **WHEN** a module requests a notification with `type`, `recipientId`, `communityId`,
  `template`, and `data`
- **THEN** a `notifications` row is created with `status = 'pending'`
- **THEN** the rendered title and body are stored for in-app display

#### Scenario: Unknown recipient
- **WHEN** the recipient does not belong to the community
- **THEN** the request is rejected and no notification is created

#### Scenario: In-app is source of truth
- **WHEN** push delivery fails
- **THEN** the notification remains available in the in-app center

### Requirement: Asynchronous delivery

Notifications SHALL be delivered asynchronously through the outbox.

#### Scenario: Enqueue delivery
- **WHEN** a notification is created
- **THEN** a `notification.requested` outbox event is enqueued

#### Scenario: Worker delivery
- **WHEN** the worker processes the event
- **THEN** it resolves preferences, renders the template, and delivers enabled channels

#### Scenario: Duplicate event
- **WHEN** the same notification event is processed twice
- **THEN** the notification is not created or delivered twice

### Requirement: Channels

The system SHALL support `in_app` and `push` channels, with an interface prepared for
`email` and `sms`.

#### Scenario: In-app delivery
- **WHEN** a notification is created
- **THEN** it is always stored and emitted in-app

#### Scenario: Push delivery
- **WHEN** the user has an active push device and push enabled
- **THEN** the push provider is invoked

#### Scenario: Channel disabled
- **WHEN** the user disabled push for that type
- **THEN** only in-app is delivered

### Requirement: Deduplication

The system SHALL deduplicate notifications using a deterministic key.

#### Scenario: Duplicate within window
- **WHEN** an unread notification exists with the same `dedupKey` within the configured
  window
- **THEN** a new notification is not created

#### Scenario: New after read
- **WHEN** the previous notification was read
- **THEN** a new notification with the same key can be created

#### Scenario: Dedup key fields
- **WHEN** a notification is created
- **THEN** its `dedupKey` is derived from `type`, `recipientId`, `resourceType`,
  `resourceId`, and the time window

### Requirement: Realtime in-app delivery

The system SHALL deliver in-app notifications in real time when the user is connected.

#### Scenario: User connected
- **WHEN** the notification is created and the user has an active socket
- **THEN** the event is emitted to `user:{userId}`
- **THEN** the client receives the notification

#### Scenario: User offline
- **WHEN** the user is not connected
- **THEN** the notification remains unread in `notifications`
- **THEN** it is returned on the next fetch

### Requirement: Read and status

The API SHALL let users list, mark as read, and count unread notifications.

#### Scenario: List notifications
- **WHEN** a user requests their notifications
- **THEN** the response is paginated and ordered by `createdAt DESC`

#### Scenario: Mark as read
- **WHEN** a user marks a notification as read
- **THEN** `read_at` is set

#### Scenario: Unread count
- **WHEN** a user requests the unread count
- **THEN** the response contains the number of unread notifications

### Requirement: Minimal push payload

Push messages SHALL NOT contain sensitive details.

#### Scenario: Push payload
- **WHEN** a push is sent
- **THEN** it contains `notificationId`, `type`, a title/body appropriate to the type, and a deep link
- **THEN** it does not contain the cédula, addresses, or biometric data
- **THEN** visitor name and vehicle plate are allowed for the resident's own pass

#### Scenario: Detail fetch
- **WHEN** the app opens the notification
- **THEN** it fetches the detail from the authenticated API

### Requirement: Rate limiting

The system SHALL prevent notification floods.

#### Scenario: Per-user limit
- **WHEN** a user exceeds the configured notifications per minute for a non-critical type
- **THEN** further notifications are coalesced or dropped

#### Scenario: Critical bypass
- **WHEN** the type is `panic_alert`
- **THEN** the rate limit does not suppress delivery
### Requirement: Topic-based notification delivery

The notification worker SHALL consume only outbox rows with topic = 'notifications'.

#### Scenario: Notification topic
- **WHEN** the notification worker polls
- **THEN** it claims only rows with topic = 'notifications'
- **THEN** it uses FOR UPDATE SKIP LOCKED

#### Scenario: Main worker isolation
- **WHEN** the main outbox worker polls
- **THEN** it does not claim notification rows

#### Scenario: Independent retries
- **WHEN** a notification push fails
- **THEN** its outbox row retries without affecting the event-store worker