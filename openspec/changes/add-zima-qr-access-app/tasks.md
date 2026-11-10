## MVP

### 1. Expo scaffold and monorepo

- [x] 1.1 Create `apps/zima-qr-access` with Expo + TypeScript + Expo Router
- [x] 1.2 Set app name “Zima QR Access”, slug `zima-qr-access`, iOS/Android bundle ids
- [x] 1.3 Add the app to `pnpm-workspace.yaml`
- [x] 1.4 Configure `metro.config.js` for pnpm workspace and `@porteria/shared`
- [x] 1.5 Add base UI theme and screen layout
- [x] 1.6 Add `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_ENV` config

### 2. Auth and context

- [x] 2.1 Implement login screen with email/password
- [x] 2.2 Store tokens in `expo-secure-store`
- [x] 2.3 Implement context selection for multiple memberships
- [x] 2.4 Implement session restore and refresh on launch
- [x] 2.5 Implement logout and token revocation
- [x] 2.6 Implement role-based home: resident, guard, or “use the dashboard” for
      `community_admin`
- [x] 2.7 Add mode/context switcher for mixed memberships (handled by the login
      context selector)

### 3. API client and shared types

- [x] 3.1 Create the authenticated API client with refresh handling
- [x] 3.2 Use `@porteria/shared` DTOs for passes and scans
- [x] 3.3 Add error mapping for 400/401/403/409/429/410
- [x] 3.4 Add loading and retry states

### 4. Resident mode

- [x] 4.1 Build resident home with active passes and quick action
- [x] 4.2 Build create-pass form (visitor, cédula, type, dates, optional window)
- [x] 4.3 Add unit selector from active memberships using `locationUnitId` and
      `locationPath` (MVP uses the active membership’s `locationUnitId`; the
      `locationPath` is shown on the pass detail and history)
- [x] 4.4 Limit type options to `entry_only` and `entry_exit` in the MVP
- [x] 4.5 Add vehicle toggle + plate field
- [x] 4.6 Add optional 4-digit PIN field
- [x] 4.7 Submit pass and navigate to detail on success
- [x] 4.8 Build pass detail with rotating QR
- [x] 4.9 Refresh the QR before 24 seconds
- [x] 4.10 Add share link with native Share
- [x] 4.11 Add copy link
- [x] 4.12 Build pass history with status/presence and `locationPath`
- [x] 4.13 Add revoke action
- [x] 4.14 Add regenerate-link action for lost phone
- [x] 4.15 Show used/revoked/expired/inside states

### 5. Guard mode

- [x] 5.1 Gate the scanner behind an open guard shift
- [x] 5.2 Start a shift with the default or a selected access point
- [x] 5.3 Change access point mid-shift
- [x] 5.4 End the shift and return to the start state
- [x] 5.5 Build scanner screen with `expo-camera`
- [x] 5.6 Request camera permission and handle denial
- [x] 5.7 Add manual token input for testing
- [x] 5.8 Call `/api/access/scan` on read
- [x] 5.9 Build scan result screen with visitor data, plate, `locationPath`,
      access point name, authorizer, and action
- [x] 5.10 Add Confirm and Reject actions
- [x] 5.11 Handle 409 already processed / token already used / scan expired /
      no active shift / not on shift at access point
- [x] 5.12 Build guard shift history
- [x] 5.13 Add empty/error states
- [x] 5.14 Route `operator` to the no-mode notice

### 6. Configuration, build, and distribution

- [ ] 6.1 Add development build configuration (EAS or local)
- [x] 6.2 Configure iOS/Android camera permissions
- [x] 6.3 Document LAN API URL for physical devices
- [ ] 6.4 Add app icons, splash screen, and name “Zima QR Access”
- [ ] 6.5 Generate and distribute an Android internal APK

### 7. Verification

- [ ] 7.1 Login as resident and create an `entry_only` pass
- [ ] 7.2 Share the link and open it on another phone
- [ ] 7.3 Verify the initial QR rotates and the link QR rotates
- [ ] 7.4 Login as guard and scan the QR
- [ ] 7.5 Confirm entry and verify the pass state
- [ ] 7.6 Reject a scan and verify the pass remains active
- [ ] 7.7 Test `entry_exit` entry and exit
- [ ] 7.8 Test vehicle plate and `locationPath` in the scan result
- [ ] 7.9 Test regenerate-link after losing the device
- [ ] 7.10 Verify `community_admin` sees the “use the dashboard” notice
- [x] 7.11 `pnpm lint` passes (root lint; the app has no dedicated lint script yet)
- [x] 7.12 `tsc --noEmit` passes for the app

## Phase 2 (deferred)

### 8. Push notifications

- [ ] 8.1 Configure `expo-notifications` and the Expo project id
- [ ] 8.2 Request permission and obtain the Expo Push Token
- [ ] 8.3 Register the token in `/api/me/push-devices` with `platform = 'expo'`
- [ ] 8.4 Handle token rotation
- [ ] 8.5 Build notification list and mark-as-read
- [ ] 8.6 Add unread badge
- [ ] 8.7 Handle deep links to pass detail and scan history

### 9. Recurring passes

- [ ] 9.1 Add `entry_exit_recurring` to the pass type selector
- [ ] 9.2 Add allowed-days and daily-window fields
- [ ] 9.3 Handle recurring availability errors from the API

### 10. Delegated authorizer

- [ ] 10.1 Add the authorizer selector for principal/subusers
- [ ] 10.2 Show the delegated authorizer in the pass detail and scan result
