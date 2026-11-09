## 1. Shared types

- [ ] 1.1 Add `NotificationChannel`, `NotificationType`, `NotificationStatus` enums
- [ ] 1.2 Add `Notification`, `NotificationPreference`, `PushDevice` types
- [ ] 1.3 Add `CreateNotificationDto`, `RegisterPushDeviceDto`, `NotificationStats` DTOs
- [ ] 1.4 Export from `packages/shared/src/index.ts`

## 2. Database schema and migration

- [ ] 2.1 Create `schema/notifications.ts` with indexes and dedup key
- [ ] 2.2 Create `schema/notification-preferences.ts` with unique constraint
- [ ] 2.3 Create `schema/push-devices.ts` with unique token
- [ ] 2.4 Update `relations.ts` and `schema/index.ts`
- [ ] 2.5 Generate and check the migration with rollback comments

## 3. Notification service

- [ ] 3.1 Create `server/api/src/modules/notifications/notification.service.ts`
- [ ] 3.2 Implement `createNotification` with dedup and rate limiting
- [ ] 3.3 Emit `notification.requested` to the outbox
- [ ] 3.4 Implement list, unread count, and mark-as-read
- [ ] 3.5 Emit in-app realtime to `user:{userId}`
- [ ] 3.6 Implement deep links

## 4. Templates

- [ ] 4.1 Create a template registry keyed by type and locale
- [ ] 4.2 Support `es` and `en` with fallback
- [ ] 4.3 Render title/body server-side and store them
- [ ] 4.4 Add a generic fallback template for unknown types

## 5. Push providers

- [ ] 5.1 Define `PushProvider` interface (`send`, `validateToken`, `health`)
- [ ] 5.2 Implement a `LogPushProvider` for development
- [ ] 5.3 Implement `WebPushProvider`
- [ ] 5.4 Implement `FcmProvider` and `ApnsProvider` adapters (or placeholders)
- [ ] 5.5 Select provider by platform and community config
- [ ] 5.6 Never log device tokens in plain text

## 6. Delivery worker

- [ ] 6.1 Implement the notification worker consuming `notification.requested`
- [ ] 6.2 Resolve preferences and quiet hours
- [ ] 6.3 Deliver in-app always; push only when enabled
- [ ] 6.4 Bypass suppression for critical types
- [ ] 6.5 Record delivery status per channel
- [ ] 6.6 Rely on outbox retries/dead-letter

## 7. Preferences API

- [ ] 7.1 Add `GET /api/me/notification-preferences`
- [ ] 7.2 Add `PATCH /api/me/notification-preferences`
- [ ] 7.3 Apply role-based defaults
- [ ] 7.4 Prevent disabling critical types
- [ ] 7.5 Evaluate quiet hours in community timezone

## 8. Push device registry

- [ ] 8.1 Add `POST /api/me/push-devices`
- [ ] 8.2 Add `DELETE /api/me/push-devices/:id`
- [ ] 8.3 Support multiple devices and token rotation
- [ ] 8.4 Mark invalid tokens from provider errors
- [ ] 8.5 Add a stale-token cleanup job

## 9. Configuration and seed

- [ ] 9.1 Add `NOTIFICATIONS_ENABLED`, push provider credentials, dedup window, rate limits
- [ ] 9.2 Seed default preferences for demo users
- [ ] 9.3 Seed a demo push device token

## 10. Verification

- [ ] 10.1 Create a notification and verify in-app storage and realtime delivery
- [ ] 10.2 Verify dedup within the window and after read
- [ ] 10.3 Verify quiet hours suppress push but not in-app
- [ ] 10.4 Verify `panic_alert` bypasses suppression
- [ ] 10.5 Verify push provider failure keeps in-app available
- [ ] 10.6 Verify token rotation and invalid token cleanup
- [ ] 10.7 Verify push payload has no sensitive fields
- [ ] 10.8 Run `pnpm lint` and `tsc --noEmit`
## 11. Expo Push and topic routing

- [ ] 11.1 Implement `ExpoPushProvider` (`send`, `validateToken`, `health`)
- [ ] 11.2 Add `platform = 'expo'` support to `push_devices`
- [ ] 11.3 Configure Expo project id and provider credentials
- [ ] 11.4 Claim only `outbox_events.topic = 'notifications'` in the notification worker
- [ ] 11.5 Ensure the main outbox worker ignores notification rows
- [ ] 11.6 Add a test that both workers do not double-claim

## 12. Pass notifications

- [ ] 12.1 Add templates for `pass_entry`, `pass_exit`, `pass_rejected`, `pass_missing_exit`, `vehicle_entry`
- [ ] 12.2 Resolve recipients: resident creator, guard, and `community_admin`
- [ ] 12.3 Include visitor first/last name and vehicle plate; exclude cédula
- [ ] 12.4 Mark `pass_missing_exit` as critical (ignore quiet hours)
- [ ] 12.5 Deduplicate per pass/cycle and per open missing-exit alert
- [ ] 12.6 Add deep links to the pass detail
- [ ] 12.7 Test entry, exit, rejection, vehicle, and missing-exit delivery