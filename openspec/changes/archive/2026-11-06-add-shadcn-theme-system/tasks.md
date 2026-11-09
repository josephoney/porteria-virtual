## 1. Theme contract

- [x] 1.1 Create `src/styles/theme.css` with `:root` variables
- [x] 1.2 Add `.dark` values for every semantic token
- [x] 1.3 Add `--radius`, `--font-sans`, `--font-heading` and `--font-mono`
- [x] 1.4 Replace direct `@theme` tokens in `index.css` with `@theme inline` mapping
- [x] 1.5 Import `theme.css` from `index.css`

## 2. Typography

- [x] 2.1 Keep Fontsource imports for the chosen UI and mono fonts
- [x] 2.2 Remove any runtime Google Fonts import
- [x] 2.3 Verify `font-sans`, `font-heading` and `font-mono` utilities resolve

## 3. No hardcoded values

- [x] 3.1 Audit components for hex/rgb/oklch colors
- [x] 3.2 Audit components for hardcoded font families
- [x] 3.3 Add a `check:theme` script that fails on hardcoded values
- [x] 3.4 Document allowed exceptions, if any

## 4. Documentation

- [x] 4.1 Create `docs/theme-system.md`
- [x] 4.2 Document how to generate/download and paste a shadcn theme
- [x] 4.3 Document the `:root` → `@theme inline` mapping
- [x] 4.4 Document how to change fonts with Fontsource
- [x] 4.5 Document dark mode and contrast checks

## 5. Verification

- [x] 5.1 Replace the theme values and verify all screens change
- [x] 5.2 Verify light/dark mode and persistence
- [x] 5.3 Verify no hardcoded colors/fonts in components
- [x] 5.4 Verify focus states and AA contrast on key screens
- [x] 5.5 `pnpm lint` and `tsc --noEmit` pass

## 6. Dashboard-01 alignment

- [x] 6.1 Add `SiteHeader` with breadcrumb, sidebar trigger and actions
- [x] 6.2 Add `SectionCards` and use it in platform/admin dashboards
- [x] 6.3 Add `ChartAreaInteractive` with real report data
- [x] 6.4 Keep the `DataTable` pattern using `Table`, `ListToolbar` and `Pagination`
- [x] 6.5 Add `NavUser` in the sidebar footer
- [x] 6.6 Avoid demo data, Tabler, dnd and TanStack; keep luma + Remixicon
