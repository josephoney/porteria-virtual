## 1. Expo scaffold and monorepo

- [ ] 1.1 Create `apps/zima-qr-access` with Expo + TypeScript + Expo Router
- [ ] 1.2 Set app name “Zima QR Access”, slug `zima-qr-access`, iOS/Android bundle ids
- [ ] 1.3 Add the app to `pnpm-workspace.yaml`
- [ ] 1.4 Configure `metro.config.js` for pnpm workspace and `@porteria/shared`
- [ ] 1.5 Add base UI theme and screen layout
- [ ] 1.6 Add `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_ENV` config

## 2. Auth and context

- [ ] 2.1 Implement login screen with email/password
- [ ] 2.2 Store tokens in `expo-secure-store`
- [ ] 2.3 Implement context selection for multiple memberships
- [ ] 2.4 Implement session restore and refresh on launch
- [ ] 2.5 Implement logout and token revocation
- [ ] 2.6 Implement role-based home (resident vs guard)
- [ ] 2.7 Add mode/context switcher for mixed memberships

## 3. API client and shared types

- [ ] 3.1 Create the authenticated API client with refresh handling
- [ ] 3.2 Use `@porteria/shared` DTOs for passes and scans
- [ ] 3.3 Add error mapping for 400/401/403/409/429/410
- [ ] 3.4 Add loading and retry states

## 4. Resident mode

- [ ] 4.1 Build resident home with active passes and quick action
- [ ] 4.2 Build create-pass form (visitor, cédula, type, dates, days, window)
- [ ] 4.3 Add unit selector from active memberships
- [ ] 4.4 Add vehicle toggle + plate field
- [ ] 4.5 Add optional 4-digit PIN field
- [ ] 4.6 Submit pass and navigate to detail on success
- [ ] 4.7 Build pass detail with rotating QR
- [ ] 4.8 Refresh the QR before 24 seconds
- [ ] 4.9 Add share link with native Share
- [ ] 4.10 Add copy link
- [ ] 4.11 Build pass history with status/presence
- [ ] 4.12 Add revoke action
- [ ] 4.13 Add regenerate-link action for lost phone
- [ ] 4.14 Show used/revoked/expired/inside states

## 5. Guard mode

- [ ] 5.1 Build scanner screen with `expo-camera`
- [ ] 5.2 Request camera permission and handle denial
- [ ] 5.3 Add manual token input for testing
- [ ] 5.4 Call `/api/access/scan` on read
- [ ] 5.5 Build scan result screen with visitor data, plate, unit, authorizer and action
- [ ] 5.6 Add Confirm action
- [ ] 5.7 Add Reject action
- [ ] 5.8 Handle 409 already processed / token already used
- [ ] 5.9 Build guard scan history
- [ ] 5.10 Add empty/error states

## 6. Notifications

- [ ] 6.1 Configure `expo-notifications` and project id
- [ ] 6.2 Request permission and obtain the Expo Push Token
- [ ] 6.3 Register the token in `/api/me/push-devices` with `platform = 'expo'`
- [ ] 6.4 Handle token rotation
- [ ] 6.5 Build notification list and mark-as-read
- [ ] 6.6 Add unread badge
- [ ] 6.7 Handle deep links to pass detail and scan history

## 7. Configuration and build

- [ ] 7.1 Add development build configuration (EAS or local)
- [ ] 7.2 Configure iOS/Android camera and notification permissions
- [ ] 7.3 Document LAN API URL for physical devices
- [ ] 7.4 Add app icons, splash screen, and name “Zima QR Access”
- [ ] 7.5 Add environment notes for Expo/FCM/APNs credentials

## 8. Verification

- [ ] 8.1 Login as resident and create an `entry_only` pass
- [ ] 8.2 Share the link and open it on another phone
- [ ] 8.3 Verify the initial QR rotates and the link QR rotates
- [ ] 8.4 Login as guard and scan the QR
- [ ] 8.5 Confirm entry and verify the resident gets a notification
- [ ] 8.6 Reject a scan and verify the pass remains active
- [ ] 8.7 Test `entry_exit` and `entry_exit_recurring`
- [ ] 8.8 Test vehicle plate in the scan result and notification
- [ ] 8.9 Test regenerate-link after losing the device
- [ ] 8.10 `pnpm lint` passes
- [ ] 8.11 `tsc --noEmit` passes for the app
