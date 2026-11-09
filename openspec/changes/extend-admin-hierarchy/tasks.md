## 1. Permission model

- [x] 1.1 Define the role/scope permission matrix
- [x] 1.2 Implement `can(requester, action, scope)` in the API
- [x] 1.3 Apply it to organizations, communities, locations, users, staff and reports
- [x] 1.4 Add matrix tests (200/403/404 per role)
- [x] 1.5 Return 403/404 consistently; never 500

## 2. Staff and memberships

- [x] 2.1 Support one membership per community for operational staff and community admins
- [x] 2.2 Allow assigning one or more communities on staff/community-admin creation
- [x] 2.3 Allow adding/removing community assignments
- [x] 2.4 Keep the person/account shared across assignments
- [x] 2.5 Add staff/community-admin context switching in the dashboard
- [x] 2.6 Allow a community admin to hold memberships in multiple communities
- [x] 2.7 Deny community creation to community admins

## 3. Superadmin console

- [x] 3.1 Add staff list (role, org, communities, status)
- [x] 3.2 Add create/edit operator and guard
- [x] 3.3 Add organization/community assignment
- [x] 3.4 Add global user search with org/community columns
- [x] 3.5 Add global reports with org/community filters
- [x] 3.6 Audit staff/structure changes

## 4. Org admin

- [x] 4.1 Allow creating/editing communities in the organization
- [x] 4.2 Manage community admins and users in scope
- [x] 4.3 Organization reports
- [x] 4.4 Prevent org_admin delegation by org_admin
- [x] 4.5 Audit changes
- [x] 4.6 Allow org_admin to manage every community in the organization without a community membership
- [x] 4.7 Keep superadmin read-only for organization/community profiles and locations

## 5. Community admin

- [x] 5.1 Manage community structure (locations)
- [x] 5.2 Manage residents and community users
- [x] 5.3 Manage community-scoped permissions
- [x] 5.4 Community reports
- [x] 5.5 Prevent cross-community assignment and org_admin
- [x] 5.6 Audit changes

## 6. UI/navigation

- [x] 6.1 Show only allowed sections per role/scope
- [x] 6.2 Add scope selectors (organization/community)
- [x] 6.3 Add clear empty/error states when no scope is selected
- [x] 6.4 Make the platform console the superadmin home

## 7. Verification

- [x] 7.1 Superadmin can create staff with multiple communities
- [x] 7.2 Org admin can create a community in their org
- [x] 7.3 Community admin can manage their structure/users only
- [x] 7.4 Cross-tenant access returns 403/404
- [x] 7.5 Reports respect scope
- [x] 7.6 `pnpm lint` and `tsc --noEmit` pass
