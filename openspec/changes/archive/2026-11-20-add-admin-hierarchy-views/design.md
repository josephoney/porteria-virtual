## Context

The hierarchy is:

```text
Superadmin
  -> Organization
       -> Org Admin
       -> Community
            -> Community Admin (delegated, one or more communities)
            -> Location sections / levels / units
```

The platform console already lists organizations, communities, sections and units. The
tenant admin panel lists communities, sections and units, but it does not let an org
admin create communities and does not expose a nested hierarchy.

## Goals / Non-Goals

**Goals:**

- Superadmin can inspect an organization and its hierarchy without editing it.
- Org admin can create communities and navigate their hierarchy.
- Community admin can manage only assigned communities.
- Community admin can be assigned to multiple communities.
- Guard/operator have read-only access.
- Logo and welcome messages are visible in context.

**Non-Goals:**

- No map rendering.
- No profile editing by superadmin.
- No new role for org admin as community admin; org scope already covers it.
- No QR/mobile implementation.

## Decisions

### 1. Expandable table rows

Use an accessible disclosure row (button with `aria-expanded`) inside the existing
tables. Do not create a separate detail page for the first iteration.

Superadmin organization row:

- organization data;
- legal representative;
- administrator or pending invitation;
- list of communities with section/unit counts.

Org admin community row:

- community profile;
- community admin or pending invitation;
- sections;
- level counts;
- access to structure.

### 2. Overview read models

Add dedicated read models instead of composing several list endpoints client-side:

```text
GET /api/platform/organizations/:id/overview
GET /api/communities/:id/overview
```

They are optimized for the expandable UI and enforce scope in the query.

### 3. Org admin community creation

Add:

```text
GET  /api/organizations/me/communities
POST /api/organizations/me/communities
PATCH /api/communities/:id
```

The org admin is always resolved from the active membership. The client cannot send an
arbitrary organization id.

### 4. Community administrator delegation

Community admin is an invitation role:

- one membership per community;
- multiple memberships allowed for the same person;
- context switching remains the existing auth mechanism;
- no community creation permission.

The org admin does not need a community-admin membership to manage a community. Their
org scope already authorizes all communities.

### 5. Read-only superadmin

The platform console can:

- create organizations;
- invite the first org admin;
- read organizations, community profiles, sections and units.

It cannot mutate community/profile/location data. Existing platform write actions for
communities/buildings/units must be removed or disabled.

### 6. UI composition

- `/platform/organizations`: expandable organization rows.
- `/platform/communities`, `/platform/sections`, `/platform/units`: read-only tables.
- `/admin`: org dashboard.
- `/admin/organization`: Mi Organización.
- `/admin/communities`: org communities with expandable rows.
- Existing structure tree is reused inside a community.

## Risks / Trade-offs

- **[Risk] N+1 overview queries** -> query children in batches and aggregate counts.
- **[Risk] Large organizations** -> paginate communities and lazy-load sections when a
  row expands.
- **[Risk] Stale counts** -> compute unit counts from `location_units` level count, not
  cached values.
- **[Risk] Permission drift** -> centralize role/scope checks in the API.

## Tests

- API integration tests for overview scope and counts.
- Permission matrix tests for superadmin/org_admin/community_admin/guard/operator.
- Manual QA for expand/collapse, mobile, branding and empty states.
