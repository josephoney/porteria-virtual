## 1. Read models

- [x] 1.1 Add `GET /api/platform/organizations/:id/overview`
- [x] 1.2 Include organization profile, legal representative and current/pending admin
- [x] 1.3 Include communities with section and unit counts
- [x] 1.4 Add `GET /api/communities/:id/overview`
- [x] 1.5 Include community profile, admin, sections and level counts
- [x] 1.6 Enforce organization/community scope in both read models
- [x] 1.7 Add loading and not-found states

## 2. Organization admin APIs

- [x] 2.1 Add `GET /api/organizations/me/communities`
- [x] 2.2 Add `POST /api/organizations/me/communities`
- [x] 2.3 Add `PATCH /api/communities/:id` for org/community admins
- [x] 2.4 Invite community admins by email for a community
- [x] 2.5 Allow the same person to hold memberships in multiple communities
- [x] 2.6 Reject community creation by community admins
- [x] 2.7 Audit community creation and profile changes

## 3. Superadmin UI

- [x] 3.1 Add accessible expandable organization rows
- [x] 3.2 Render organization data, legal representative and administrator
- [x] 3.3 Render pending admin invitation state
- [x] 3.4 Render communities and their section/unit counts
- [x] 3.5 Make community, section and unit views read-only
- [x] 3.6 Remove/disable platform create actions for tenant locations
- [x] 3.7 Show organization/community logo with fallback
- [x] 3.8 Show welcome messages where applicable
- [x] 3.9 Add mobile layout for expanded content

## 4. Org admin UI

- [x] 4.1 Add **Mi Organización** to the sidebar
- [x] 4.2 Add organization profile, legal representative, logo and welcome form
- [x] 4.3 Add **Comunidades** with only organization communities
- [x] 4.4 Add create-community action
- [x] 4.5 Add expandable community rows
- [x] 4.6 Show community profile, admin and welcome
- [x] 4.7 Show sections and levels; open the structure tree
- [x] 4.8 Allow creating sections and units from the community
- [x] 4.9 Add community-admin invitation action
- [x] 4.10 Prevent org admin from delegating `org_admin`

## 5. Community admin / guard / operator

- [x] 5.1 Community admin sees only assigned communities
- [x] 5.2 Community admin sees only assigned structure and residents
- [x] 5.3 Community admin cannot create communities
- [x] 5.4 Guard/operator get read-only community/section/unit access
- [x] 5.5 Hide all create/edit actions for read-only roles

## 6. Tests

### Unit

- [x] 6.1 Scope resolver for org/community admin
- [x] 6.2 Multiple community-admin memberships
- [x] 6.3 Org admin implicit access to all communities
- [x] 6.4 Read-only role permission matrix
- [x] 6.5 Overview aggregation helpers

### Integration

- [x] 6.6 Superadmin organization overview returns profile, legal, admin and communities
- [x] 6.7 Superadmin cannot create/update community, section or unit
- [x] 6.8 Org admin creates a community and superadmin sees it
- [x] 6.9 Org admin manages all communities in own organization without community membership
- [x] 6.10 Community admin sees two assigned communities
- [x] 6.11 Community admin cannot create a community
- [x] 6.12 Community admin cannot read another community
- [x] 6.13 Guard/operator receive read-only responses and 403 on writes
- [x] 6.14 Overview counts match hierarchy data
- [x] 6.15 Cross-tenant overview returns 404

### QA visual

- [x] 6.16 Expand/collapse organization row
- [x] 6.17 Expand community and inspect sections/levels
- [x] 6.18 Org admin creates a community
- [x] 6.19 Logo and welcome render in sidebar/home
- [x] 6.20 Fallback icon appears without logo
- [x] 6.21 Mobile rows/forms remain usable
- [x] 6.22 `pnpm lint` and `tsc --noEmit` pass
