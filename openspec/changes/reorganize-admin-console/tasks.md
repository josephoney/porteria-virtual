## 1. Navigation shell and routes

- [x] 1.1 Define sidebar items, groups and visibility matrix
- [x] 1.2 Add route constants and nested routes for platform, admin and analysis
- [x] 1.3 Add the `/platform` dashboard route and redirects from `/admin` and `/analysis`
- [x] 1.4 Mark active route and collapse sidebar into a sheet on mobile
- [x] 1.5 Guard routes by role/scope and redirect unauthorized access

## 2. Shared list-page pattern

- [x] 2.1 Create a reusable page header with title, description and primary action
- [x] 2.2 Create a reusable filter bar with search and scoped filters
- [x] 2.3 Add loading skeleton, empty state and error/retry to list pages
- [x] 2.4 Standardize pagination and row actions
- [x] 2.5 Standardize create/edit dialogs or sheets

## 3. Platform pages

- [x] 3.1 Split `/platform/organizations` into a table page
- [x] 3.2 Split `/platform/communities` into a table page
- [x] 3.3 Split `/platform/sections` into a table page with type filter
- [x] 3.4 Split `/platform/units` into a table page
- [x] 3.5 Split `/platform/invitations` into a table page
- [x] 3.6 Split `/platform/users` into a table page
- [x] 3.7 Remove the old platform tabs from the main page

## 4. Tenant pages

- [x] 4.1 Add org_admin `/admin/communities`
- [x] 4.2 Add `/admin/sections` for org_admin and community_admin
- [x] 4.3 Add `/admin/units` for org_admin and community_admin
- [x] 4.4 Add `/admin/invitations` for org_admin and community_admin
- [x] 4.5 Add `/admin/users` for org_admin and community_admin
- [x] 4.6 Add `/analysis/bitacora` and `/analysis/reports` for org/community admins
- [x] 4.7 Add `/analysis/bitacora` and `/analysis/reports` for guard/operator
- [x] 4.8 Remove the old admin tabs from the main page`r`n- [x] 4.9 Add NavUser footer menu with account, notifications, theme, context and logout

## 5. Sections and units

- [x] 5.1 Consume the paginated sections API from `add-configurable-location-hierarchy`
- [ ] 5.2 Show name, type, community, levels, units and status
- [ ] 5.3 Add community/type/search filters
- [ ] 5.4 Add create/edit with `sectionType` and `other` label
- [ ] 5.5 Add units page filtered by community and section
- [ ] 5.6 Verify type changes preserve children, units and residents

## 6. Access log views

- [ ] 6.1 Keep Bitácora as the readable per-entrance access log
- [ ] 6.2 Add fields: date, time, result, person, vehicle, guard, authorizer, destination
  section/unit, community and entrance
- [ ] 6.3 Keep Historial as the technical event view for superadmin only
- [ ] 6.4 Add organization/community/code traceability and diagnostic metadata to Historial
- [ ] 6.5 Keep Reportes for guard/operator, community_admin, org_admin and superadmin with scope
- [ ] 6.6 Ensure direct access to Historial for non-superadmin returns 403

## 7. Permissions and scope

- [x] 7.1 Hide items not allowed for the active role/context
- [x] 7.2 Apply platform/organization/community filters on each page
- [x] 7.3 Return/redirect 403/404 consistently for unauthorized routes
- [x] 7.4 Prevent community_admin from seeing Organizaciones, Comunidades or Historial
- [x] 7.5 Keep platform context free of Operador/Guardia tenant items

## 8. Verification

- [x] 8.1 Platform admin sees six structure menus plus Bitácora/Reportes/Historial
- [x] 8.2 Org admin sees Communities/Sections/Units/Invitations/Users plus Bitácora/Reportes
- [x] 8.3 Community admin sees Sections/Units/Invitations/Users plus Bitácora/Reportes
- [x] 8.4 Guard/operator sees Operación plus Bitácora/Reportes
- [x] 8.5 Historial is not shown or accessible to non-superadmin
- [x] 8.6 Deep links render the correct page and active item
- [ ] 8.7 Mobile sidebar opens as a sheet and closes on navigation
- [x] 8.8 Tables show loading, empty and error states
- [x] 8.9 `pnpm lint` and `tsc --noEmit` pass
