## ADDED Requirements

### Requirement: Notification enums

The shared package SHALL define notification types, channels, statuses, and platforms.

#### Scenario: Notification channel enum
- **WHEN** a developer uses `NotificationChannel.InApp`
- **THEN** the value is the string `'in_app'`
- **THEN** the enum includes `InApp`, `Push`, `Email`, and `Sms`

#### Scenario: Notification type enum
- **WHEN** a developer uses `NotificationType.PanicAlert`
- **THEN** the value is the string `'panic_alert'`
- **THEN** the enum includes at least `PanicAlert`, `MissedCall`, `VisitorArrived`,
  `PackageReceived`, `Announcement`, `TicketUpdated`, `PassEntry`, `PassExit`,
  `PassRejected`, `PassMissingExit`, and `VehicleEntry`

#### Scenario: Notification status enum
- **WHEN** a developer uses `NotificationStatus.Pending`
- **THEN** the value is the string `'pending'`
- **THEN** the enum includes `Pending`, `Sent`, `Failed`, and `Read`

#### Scenario: Push platform enum
- **WHEN** a developer uses `PushPlatform.Expo`
- **THEN** the value is the string `'expo'`
- **THEN** the enum includes `Web`, `Android`, `Ios`, and `Expo`

### Requirement: Notification entity and DTOs

The shared package SHALL define notification types and payloads.

#### Scenario: Notification type
- **WHEN** a developer inspects `Notification`
- **THEN** it includes `id`, `userId`, `communityId`, `type`, `channel`, `title`,
  `body`, `data`, `deepLink`, `status`, `readAt`, `createdAt`

#### Scenario: Create notification DTO
- **WHEN** a developer inspects `CreateNotificationDto`
- **THEN** it includes `type`, `recipientId`, `communityId`, `template`, `data`,
  `dedupKey?`, and `critical?`

#### Scenario: Preference type
- **WHEN** a developer inspects `NotificationPreference`
- **THEN** it includes `userId`, `communityId`, `type`, `channel`, `enabled`,
  `quietHoursStart`, `quietHoursEnd`

### Requirement: Pass notification data

The shared package SHALL define the pass notification payload.

#### Scenario: Pass notification data
- **WHEN** a developer inspects `PassNotificationData`
- **THEN** it includes `passId`, `notificationType`, `visitorFirstName`,
  `visitorLastName`, `vehiclePlate?`, `unitCode`, `communityName`, and `deepLink`
- **THEN** it does not include `visitorDocument`
