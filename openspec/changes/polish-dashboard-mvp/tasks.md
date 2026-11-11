# Tasks

## 1. Brand assets and theme

- [x] 1.1 Copy `images/fondo_contacto.png` and `images/LogoZima_W.svg` into `apps/dashboard/public/brand/` (or import them through Vite) and remove any reference to the repo-root `images/` folder from the dashboard.
- [x] 1.2 Add `--success` and `--success-foreground` to `apps/dashboard/src/styles/theme.css` and map them in `apps/dashboard/src/index.css`; verify with `pnpm --filter @porteria/dashboard check:theme`.
- [x] 1.3 Create `AuthShell` with the 55/45 two-column layout, image cover, theme overlay, logo, “Zima Seguridad”, “Sistema Portería virtual y accesos”, and the 180–220px mobile hero; use theme tokens only.

## 2. Login and signup

- [x] 2.1 Refactor `LoginPage` to render `AuthShell` and move the existing login card into the right column without changing authentication behavior.
- [x] 2.2 Add “Iniciar sesión” / “Crear cuenta” tabs inside the right card, keeping the context-selection state inside the same shell.
- [x] 2.3 Implement the signup tab using the existing invitation flow: invitation token or community slug + email, token prefilled from `/invite/:token`, email locked when the token is present, and “Pedí una invitación a tu administrador” when no invitation is available.
- [x] 2.4 Add responsive, light/dark and context-selection Playwright coverage for the auth shell. Cubre login de escritorio, tab de alta, mobile 390x844 sin overflow, tema oscuro por preferencia persistida y selección de contexto con `multi@porteria.local`.

## 3. Users API

- [x] 3.1 Extend `GET /api/users` with `search` (email, account name, person first/last name, document number) and `status=active|inactive` filtering `users.active`; keep `communityId`, `page` and `pageSize`.
- [x] 3.2 Return `scopeTotal` (scoped users without search/status) and `total` (filtered users) alongside `data`, `page` and `pageSize`; keep distinct-user counting.
- [x] 3.3 Update `docs/api-v1-contract.md` and the API integration tests for search, status, `scopeTotal` and multi-community users.
- [x] 3.4 Add fixtures for document search and for a user with memberships in two communities.

## 4. Users table UI

- [x] 4.1 Add the filter bar: search input, status select (Todos/Activos/Inactivos), “Limpiar”, 300–400 ms debounce and page reset to 1.
- [x] 4.2 Show the scope count above the table: organization, community, community filter, and “M resultados de N usuarios” when filters are active.
- [x] 4.3 Replace the columns with **Cuenta | Persona | Documento | Comunidad | Membresía | Estado**; render one row per membership and merge Cuenta/Persona/Documento/Estado with `rowSpan`.
- [x] 4.4 In Membresía, render the compact role select and two horizontal icon buttons (add assignment / remove assignment) with `aria-label` and tooltips; reuse the existing dialogs and endpoints.
- [x] 4.5 In Estado, render one green/red pill per user with `aria-pressed`; toggle `PATCH /api/users/:id {active}` optimistically with rollback on error; remove the old “Activo” column.
- [x] 4.6 Keep rows compact (`h-10`, `py-2`, `text-sm`, `whitespace-nowrap`, small select, xs icons) and order multi-community rows consistently.
- [x] 4.7 Add Playwright coverage for filters, scoped count, multi-community rows, icon actions and the global status toggle.

## 5. Community detail expansion

- [x] 5.1 Remove the “Detalle” action; make the whole community row clickable and keyboard accessible (`role=button`, `tabIndex=0`, Enter/Space, `aria-expanded`) with a rotating chevron; keep one community expanded at a time.
- [x] 5.2 Keep “Invitar admin” and “Ver estructura” as actions and stop propagation so they do not toggle the row.
- [x] 5.3 Add the structure summary to the expanded row: uniform sentence, non-uniform fallback, or “Sin estructura definida” + “Definir estructura”.
- [x] 5.4 Extend `GET /api/communities/:id/overview` with `structureSummary` (structureId, levelCount, levelNames, level1Count, level2Count, leafCount, uniform, perLevel1, perLevel2) and integration tests.
- [x] 5.5 Add Playwright coverage for expand/collapse, action isolation and the Torre Norte summary.

## 6. Validation

- [x] 6.1 Typecheck dashboard, API, shared and the remaining packages.
- [x] 6.2 Run the API integration suite for users filters, scoped totals and community overview.
- [x] 6.3 Run the auth, users and community Playwright suites in desktop and mobile. Desktop suite 34/34; mobile auth-shell smoke added in `tests/polish-dashboard.spec.ts` (390x844).
- [x] 6.4 Run Prettier, dashboard/API lint, `check:theme` and `openspec validate polish-dashboard-mvp --strict`.
- [x] 6.5 Do not run a build; do not commit or push unless explicitly requested.
