## 1. Signaling authentication

- [x] 1.1 Add JWT verification to the Socket.io handshake
- [x] 1.2 Derive role/org/community/membership from the token; reject invalid tokens
- [x] 1.3 Restrict operator registration to operational roles
- [x] 1.4 Join operators to `community:{id}` and `operators`
- [x] 1.5 Emit kiosks/calls only to the community room
- [x] 1.6 Validate role and community in `door:open`
- [x] 1.7 Validate role and community in `relay:trigger`
- [x] 1.8 Record security events for rejected actuation
- [x] 1.9 Remove client-supplied `communityId`/`operatorId` trust

## 2. Kiosk authentication

- [x] 2.1 Add `device_token_hash` and rotation fields to kiosks
- [x] 2.2 Add device token provisioning and rotation endpoints
- [x] 2.3 Require the device token on kiosk connect
- [x] 2.4 Resolve kiosk/community/org from the token; ignore payload spoofing
- [x] 2.5 Update the kiosk app to send the device token

## 3. Platform context isolation

- [x] 3.1 Detect platform context (`membershipId = 'platform'`) in tenant routes
- [x] 3.2 Return 403 with a “select a community” message, never 500
- [x] 3.3 Hide Operator/Admin/Guard in platform context
- [x] 3.4 Make `/platform` the platform home
- [x] 3.5 Add a global user consultation screen in `/platform`
- [x] 3.6 Remove the global Admin > Users view for platform context

## 4. Role guardrails

- [x] 4.1 Implement `canAssignRole(requester, role, scope)` in the API
- [x] 4.2 Apply it in `users.service.createUser`
- [x] 4.3 Apply it in `memberships.service.create/update`
- [x] 4.4 Reject `community_admin → org_admin` with 403
- [x] 4.5 Hide non-assignable roles in the Users form
- [x] 4.6 Add regression tests for role escalation

## 5. Dashboard routing and socket

- [x] 5.1 Protect `/` with an operational-role guard
- [x] 5.2 Add a resident “use the Zima app” screen or redirect
- [x] 5.3 Connect the operator socket only for operational roles
- [x] 5.4 Do not connect the operator socket in platform context
- [x] 5.5 Add tests for resident/platform socket behavior

## 6. Call scope

- [x] 6.1 Restrict only `operator` to their own calls
- [x] 6.2 Let `community_admin` see community calls
- [x] 6.3 Let `org_admin` see organization calls
- [x] 6.4 Return 403 for platform context without tenant
- [x] 6.5 Add API tests for each role

## 7. Kiosk identity and legacy cleanup

- [x] 7.1 Detect duplicate `rpi_id` rows
- [x] 7.2 Rename/remove the legacy kiosk safely
- [x] 7.3 Add unique constraint or community-scoped resolution
- [ ] 7.4 Remove or migrate the legacy organization/community/calls per backup policy
  (follow-up: requires a verified backup and a maintenance window; the legacy tenant is
  already isolated and no admin can access it)
- [x] 7.5 Update the seed to produce a unique kiosk and deterministic data
- [x] 7.6 Add `communityId` to the resolve endpoint
- [x] 7.7 Verify new calls/events belong to Torre Norte

## 8. Verification

- [x] 8.1 Anonymous socket cannot register as operator
- [x] 8.2 Resident socket cannot register as operator
- [x] 8.3 Operator of community A does not receive community B calls/kiosks
- [x] 8.4 Operator cannot open another community's door/relay
- [x] 8.5 Platform admin tenant calls return 403, not 500
- [x] 8.6 Community admin cannot create org_admin
- [x] 8.7 Resident is redirected away from the operator panel
- [x] 8.8 Call scope matrix matches the proposal
- [x] 8.9 New kiosk resolves unambiguously and calls land in Torre Norte
- [x] 8.10 `pnpm lint` and `tsc --noEmit` pass
