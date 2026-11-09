## 1. Design tokens

- [x] 1.1 Audit `index.css` and `App.css`; list duplicated/legacy tokens
- [x] 1.2 Consolidate colors, radii, fonts, spacing and shadows in `@theme`
- [x] 1.3 Replace hardcoded colors/values in dashboard components
- [x] 1.4 Remove or migrate legacy `App.css` classes
- [x] 1.5 Define complete dark-mode token values
- [x] 1.6 Ensure Geist / Geist Mono come from `@fontsource`, not runtime Google Fonts

## 2. Component catalog

- [x] 2.1 Document the shadcn components in `docs/design-system.md`
- [x] 2.2 Document variants and do/don't for buttons, badges, alerts and cards
- [x] 2.3 Standardize icon usage with Remixicon and `aria-label` on icon-only buttons
- [ ] 2.4 Standardize `cn()` usage and avoid ad-hoc class strings

## 3. Layout and navigation

- [x] 3.1 Standardize the dashboard shell (sidebar + top bar + main)
- [x] 3.2 Make the sidebar collapse into a sheet on mobile
- [x] 3.3 Highlight the active route and filter by role/context
- [x] 3.4 Standardize the context selector and user menu

## 4. Forms

- [x] 4.1 Create a form pattern using Field/Label/Input/Select
- [ ] 4.2 Standardize inline validation and error messages
- [ ] 4.3 Add destructive confirmation dialogs
- [x] 4.4 Add loading/disabled states to submit buttons
- [ ] 4.5 Add `aria-invalid` and `aria-describedby` to fields

## 5. Tables and data states

- [x] 5.1 Create a table pattern with header, actions and pagination
- [x] 5.2 Add skeleton loading, empty state and error/retry
- [x] 5.3 Make tables responsive (horizontal scroll or cards)
- [x] 5.4 Standardize status badges and date formatting

## 6. Cards, metrics and overlays

- [ ] 6.1 Standardize metric and content cards
- [ ] 6.2 Standardize dialogs/sheets (focus, Escape, return focus)
- [ ] 6.3 Standardize destructive dialog copy and button variant
- [ ] 6.4 Standardize button variants and pending states

## 7. Accessibility and responsive

- [ ] 7.1 Verify keyboard navigation and visible focus
- [ ] 7.2 Verify AA contrast in light/dark
- [ ] 7.3 Add `aria-live` for errors/toasts
- [ ] 7.4 Test at mobile, tablet and desktop breakpoints
- [x] 7.5 Add a basic accessibility checklist to the docs

## 8. Verification

- [ ] 8.1 Review every dashboard screen for token usage
- [x] 8.2 Verify no hardcoded colors remain in dashboard components
- [ ] 8.3 Verify dark mode in all screens
- [ ] 8.4 Verify forms/tables have loading/empty/error states
- [ ] 8.5 Verify mobile sidebar and responsive tables
- [x] 8.6 `pnpm lint` and `tsc --noEmit` pass
