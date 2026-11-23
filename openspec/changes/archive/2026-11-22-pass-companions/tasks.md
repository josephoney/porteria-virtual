# Tasks: pass-companions

## 1. Data and API

- [x] 1.1 Add `companions` JSONB default `[]` to `access_passes` and generate the migration.
- [x] 1.2 Add `PassCompanion` and `companions` to `CreatePassDto` and the detail/list/public types.
- [x] 1.3 Validate required fields, max 10 companions and duplicate documents in the API.
- [x] 1.4 Persist companions in `createPass` and `createPassBatch`.
- [x] 1.5 Return companions in list/detail and in the guard candidate; expose `companionCount` in the public preview and include companions in bitacora details.
- [x] 1.6 Add API tests for creation, validation, bulk rows, candidate and bitacora.

## 2. Dashboard

- [x] 2.1 Add the companions card to `ResidentAuthorizationNewPage` with add/remove rows.
- [x] 2.2 Show companions in the review summary.
- [x] 2.3 Parse the `companions` column in the bulk CSV and document the format.
- [x] 2.4 Show companions in the history and the expanded detail.

## 3. Mobile resident app

- [x] 3.1 Add the companions card to `app/create.tsx`.
- [x] 3.2 Show companions in the pass detail.

## 4. Guard app

- [x] 4.1 Show companions in the identity candidate.
- [x] 4.2 Show companions in the bitacora and pass detail.
- [x] 4.3 Show companions in the QR scan result before the confirm/reject actions.

## 5. Verification

- [x] 5.1 Build `@porteria/shared` and typecheck the API.
- [x] 5.2 Typecheck the mobile app and pass-web; lint/typecheck the dashboard pages touched.
- [x] 5.3 Run Prettier and `openspec validate pass-companions --strict`.
- [x] 5.4 Run the API suites and a manual smoke test of the dashboard, mobile and guard flows.
      Suites en el PC: 40/40 unitarias y 185/185 de integración.
      Smoke manual en staging con un pase de dos acompañantes: dashboard, formulario
      móvil de residente, escaneo del guardia con acompañantes listados, búsqueda por
      documento y página pública mostrando la cantidad sin documentos.

## 6. Follow-ups

- [x] 6.1 Show the companion count on the public pre-bind card (`apps/pass-web/src/components/PreviewCard.tsx`), not only in `QrView`. Does not block the current deploy.
