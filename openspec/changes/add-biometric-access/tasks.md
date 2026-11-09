## 1. Shared types and DTOs

- [ ] 1.1 Add `BiometricMode`, `BiometricProviderKind`, `BiometricConsentStatus`, `BiometricTemplateStatus` enums
- [ ] 1.2 Add `BiometricConsent`, `BiometricTemplate`, `BiometricProviderConfig` types
- [ ] 1.3 Add `EnrollBiometricRequest`, `VerifyBiometricRequest`, `VerifyBiometricResponse` DTOs
- [ ] 1.4 Export new types/enums/DTOs from `packages/shared/src/index.ts`

## 2. Database schema

- [ ] 2.1 Create `schema/biometric-consents.ts` with unique active consent constraint
- [ ] 2.2 Create `schema/biometric-templates.ts` with encrypted/ref columns, `status`, `deleted_at`
- [ ] 2.3 Create `schema/biometric-provider-configs.ts` with mode, thresholds, max gallery
- [ ] 2.4 Update `relations.ts` for consents, templates, provider configs, users
- [ ] 2.5 Update `schema/index.ts` exports

## 3. Migration

- [ ] 3.1 Generate `migrations/0005_biometric_access.sql`
- [ ] 3.2 Add enums `biometric_mode`, `biometric_provider_kind`, `biometric_consent_status`, `biometric_template_status`
- [ ] 3.3 Create `biometric_consents`, `biometric_templates`, `biometric_provider_configs`
- [ ] 3.4 Add indexes and the one-config-per-community unique constraint
- [ ] 3.5 Add rollback comment block

## 4. Consent service

- [ ] 4.1 Implement `grantConsent(userId, communityId, policyVersion, evidenceRef)`
- [ ] 4.2 Implement `revokeConsent(consentId)` and template cascade
- [ ] 4.3 Implement `getActiveConsent(userId, communityId)`
- [ ] 4.4 Enforce consent before enrollment and verification
- [ ] 4.5 Handle policy version changes and re-consent

## 5. Enrollment service

- [ ] 5.1 Implement `POST /api/communities/:id/biometric/enroll` restricted to `community_admin`/`operator`
- [ ] 5.2 Call provider `enroll` with capture and options
- [ ] 5.3 Validate liveness pass and quality score
- [ ] 5.4 Detect duplicate faces within the community
- [ ] 5.5 Persist an encrypted template or provider reference
- [ ] 5.6 Discard raw images after template generation
- [ ] 5.7 Link the template to a `biometric` credential for the subject
- [ ] 5.8 Implement re-enrollment and template replacement

## 6. Provider adapter

- [ ] 6.1 Define `BiometricProvider` interface (`enroll`, `verify`, `identify`, `delete`, `health`)
- [ ] 6.2 Implement an `EdgeBiometricProvider` adapter
- [ ] 6.3 Add an `OnPremBiometricProvider` HTTP adapter (Python service ready)
- [ ] 6.4 Add a `CloudBiometricProvider` adapter placeholder behind config
- [ ] 6.5 Implement provider selection per community from `biometric_provider_configs`
- [ ] 6.6 Implement capability checks (liveness, modes, max gallery)
- [ ] 6.7 Implement health checks, timeout, and degraded state
- [ ] 6.8 Ensure no sensitive payloads are logged

## 7. Verification service

- [ ] 7.1 Implement `POST /api/internal/biometric/verify`
- [ ] 7.2 Implement 1:1 mode with subject identification
- [ ] 7.3 Implement scoped 1:N mode with gallery limit and threshold
- [ ] 7.4 Require liveness and map failures to `liveness_failed`
- [ ] 7.5 Enforce per-subject and per-device rate limits
- [ ] 7.6 Return `matched`, `score`, `liveness`, `subjectId`, `reason`
- [ ] 7.7 Never return candidate lists or embeddings

## 8. Access engine integration

- [ ] 8.1 Map a successful biometric verification to an `allow` candidate credential
- [ ] 8.2 Map failures to deny reasons (`biometric_mismatch`, `no_template`, `liveness_failed`, `unknown_biometric`)
- [ ] 8.3 Record `biometric.verify_success` / `biometric.verify_failed` events
- [ ] 8.4 Ensure QR fallback remains available for every biometric subject

## 9. Offline support

- [ ] 9.1 Include biometric provider config and template hashes in the policy snapshot
- [ ] 9.2 Cache encrypted templates on edge devices with a TTL
- [ ] 9.3 Delete cached templates when a consent revocation arrives in the delta
- [ ] 9.4 Enforce `fail_policy` when templates are stale or provider is unavailable
- [ ] 9.5 Audit offline biometric decisions with `source = 'offline'`

## 10. Privacy and data subject requests

- [ ] 10.1 Implement `GET /api/me/biometric` returning metadata only
- [ ] 10.2 Implement `GET /api/me/biometric/export`
- [ ] 10.3 Implement `DELETE /api/me/biometric` (withdraw consent + delete templates)
- [ ] 10.4 Enforce role-based access to biometric metadata
- [ ] 10.5 Implement retention and purge job for revoked/inactive templates
- [ ] 10.6 Verify purge reports counts and failures

## 11. Audit

- [ ] 11.1 Emit `biometric.consent_granted` / `biometric.consent_revoked`
- [ ] 11.2 Emit `biometric.enrolled` / `biometric.enrollment_failed`
- [ ] 11.3 Emit `biometric.template_replaced` / `biometric.template_deleted`
- [ ] 11.4 Ensure events never contain images, embeddings, or templates
- [ ] 11.5 Add a biometric audit view for admins

## 12. Configuration and seed

- [ ] 12.1 Add `BIOMETRIC_ENABLED`, provider timeout, and cache TTL env keys
- [ ] 12.2 Seed a provider config for the demo community (edge, 1:1, liveness required)
- [ ] 12.3 Seed a consent and a demo template reference
- [ ] 12.4 Keep seed idempotent and biometric disabled by default in production

## 13. Verification

- [ ] 13.1 Enroll a user with consent and confirm template metadata only
- [ ] 13.2 Verify 1:1 success and mismatch
- [ ] 13.3 Verify liveness failure denies access
- [ ] 13.4 Verify 1:N gallery limit is enforced
- [ ] 13.5 Verify consent withdrawal deletes templates and blocks biometrics
- [ ] 13.6 Verify QR fallback works when biometrics are unavailable
- [ ] 13.7 Verify offline verification and revocation propagation
- [ ] 13.8 Verify no sensitive data appears in logs or audit events
- [ ] 13.9 Run `pnpm lint` and `tsc --noEmit`
