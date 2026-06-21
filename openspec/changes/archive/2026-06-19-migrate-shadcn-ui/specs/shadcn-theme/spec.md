## ADDED Requirements

### Requirement: Tailwind CSS v4 with project tokens
The dashboard SHALL use Tailwind CSS v4 configured with design tokens matching the existing visual identity.

#### Scenario: Color tokens mapped
- **WHEN** a developer uses `bg-background` or `text-foreground` in a component
- **THEN** the colors match the existing `--bg: #f5f4ef` and `--ink: #1a1916`
- **THEN** the full token set is available: background, foreground, card, border, muted, primary, destructive, warning, secondary

#### Scenario: Font families preserved
- **WHEN** text is rendered with `font-sans` or `font-mono`
- **THEN** it uses Syne and IBM Plex Mono respectively, matching the current Google Fonts import

#### Scenario: Border radius matches design
- **WHEN** shadcn-ui components (Button, Card, Input) render
- **THEN** the border radius is 0.375rem (6px), matching the existing `border-radius: 4px-6px` range

### Requirement: CSS custom properties as shadcn theme
The shadcn-ui theme SHALL be defined via CSS custom properties in `index.css`, NOT via Tailwind config JS.

#### Scenario: Theme applied globally
- **WHEN** the dashboard loads
- **THEN** `index.css` imports Tailwind directives and defines `@theme` with CSS variables for light mode
- **THEN** all shadcn-ui components inherit the correct colors automatically

#### Scenario: Tailwind Vite plugin active
- **WHEN** the Vite dev server starts
- **THEN** `@tailwindcss/vite` plugin is registered in `vite.config.ts`
- **THEN** Tailwind utility classes are available in all components

### Requirement: Utility cn() function
The project SHALL provide a `cn()` utility that merges Tailwind classes with conflict resolution.

#### Scenario: cn merges classes
- **WHEN** `cn('px-4 py-2', 'py-4')` is called
- **THEN** the result is `'px-4 py-4'` (later `py-4` overrides earlier `py-2`)
- **THEN** falsy values (`undefined`, `false`, `null`) are filtered out
