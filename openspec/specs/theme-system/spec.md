# theme-system Specification

## Purpose

Define the single-source visual theme contract for the dashboard: shadcn-compatible
tokens, typography, dark mode and build-time application.

## Requirements

### Requirement: Shadcn-compatible theme source

The dashboard SHALL define its visual theme in a single shadcn-compatible CSS file.

#### Scenario: Theme file

- **WHEN** a developer opens `src/styles/theme.css`
- **THEN** it contains `:root` and `.dark` variables for background, foreground, card,
  popover, primary, secondary, muted, accent, destructive, border, input, ring and
  sidebar tokens
- **THEN** it contains `--radius`, `--font-sans`, `--font-heading` and `--font-mono`

#### Scenario: Tailwind mapping

- **WHEN** the dashboard boots
- **THEN** `src/main.tsx` imports `theme.css` before `index.css`
- **THEN** `src/index.css` maps the theme variables with `@theme inline`
- **THEN** components use semantic utilities such as `bg-background`, `text-foreground`,
  `border-border`, `font-sans` and `font-mono`

#### Scenario: Replace theme

- **WHEN** a theme generated or downloaded from shadcn replaces `theme.css`
- **THEN** colors, radius and dark mode change without editing component files
- **THEN** the app recompiles and uses the new values

### Requirement: Parametrized typography

Typography SHALL be configured through tokens, not component classes.

#### Scenario: UI and data fonts

- **WHEN** a component renders UI text or technical data
- **THEN** it uses `font-sans`, `font-heading` or `font-mono`
- **THEN** it does not declare a hardcoded font family

#### Scenario: Font families

- **WHEN** a developer inspects `theme.css`
- **THEN** `--font-ui` and `--font-heading-font` resolve to `Geist Variable`
- **THEN** `--font-code` resolves to `Geist Mono Variable`
- **THEN** all three families are self-hosted from `@fontsource-variable/*`

#### Scenario: Font loading

- **WHEN** the app loads fonts
- **THEN** it uses Fontsource packages
- **THEN** it does not import Google Fonts at runtime

### Requirement: No hardcoded visual values

Components SHALL NOT contain raw color or font values.

#### Scenario: Raw colors

- **WHEN** a component needs a color
- **THEN** it uses a semantic token or utility
- **THEN** it does not use hex, `rgb()`, or `oklch()` outside `theme.css`

#### Scenario: Validation

- **WHEN** the theme validation script runs
- **THEN** it fails if a raw color or font family appears outside `theme.css`
- **THEN** it fails if a Google Fonts import is present
- **THEN** it reports the offending file and line

### Requirement: Dark mode

The theme SHALL define light and dark values with the same token names.

#### Scenario: Dark tokens

- **WHEN** the `.dark` class is active
- **THEN** every semantic color token has a dark value
- **THEN** text/background combinations meet AA contrast on key screens

#### Scenario: Persistence

- **WHEN** the user changes the theme
- **THEN** the choice persists across reloads

### Requirement: Theme documentation

The project SHALL document how to replace the theme.

#### Scenario: Guide

- **WHEN** a developer opens `docs/theme-system.md`
- **THEN** they find how to generate/download a shadcn theme, paste it, map missing
  variables, change fonts with Fontsource and validate dark mode/contrast

#### Scenario: Exceptions

- **WHEN** a raw value is unavoidable
- **THEN** it is documented as an explicit exception with a reason

### Requirement: Dashboard composition alignment

The dashboard SHALL follow the `dashboard-01` composition using project data and the
project component stack.

#### Scenario: Shell

- **WHEN** an authenticated user opens the dashboard
- **THEN** the shell shows a `SiteHeader` with breadcrumb, sidebar trigger and header
  actions
- **THEN** the sidebar footer shows the `NavUser` menu

#### Scenario: Summary cards

- **WHEN** the platform or tenant dashboard opens
- **THEN** `SectionCards` renders scoped metrics with labels, values and descriptions

#### Scenario: Activity chart

- **WHEN** a tenant dashboard opens
- **THEN** `ChartAreaInteractive` renders access/call activity from
  `/api/reports/event-breakdown`
- **THEN** it does not use hardcoded demo series

#### Scenario: Data table

- **WHEN** a list page renders
- **THEN** it uses the shared `Table`, `ListToolbar` and `Pagination` pattern
- **THEN** it does not require dnd, TanStack table or demo data

#### Scenario: Stack consistency

- **WHEN** the block is adapted
- **THEN** it keeps luma, Remixicon and the Geist / Geist Mono typography loaded via
  Fontsource
- **THEN** it does not add Tabler icons or a second UI library

### Requirement: Build-time scope

The theme SHALL be applied at build time.

#### Scenario: No runtime theme API

- **WHEN** the theme changes
- **THEN** the change is made in `theme.css` and the app is rebuilt
- **THEN** no API or database call is required

#### Scenario: Future runtime themes

- **WHEN** runtime or per-tenant themes are needed
- **THEN** they are introduced by a separate change with persistence, validation and
  contrast requirements
