## ADDED Requirements

### Requirement: Single source of design tokens

The dashboard SHALL define all visual tokens in one place.

#### Scenario: Color tokens

- **WHEN** a component needs a color
- **THEN** it uses a token such as `background`, `foreground`, `primary`, `secondary`,
  `muted`, `destructive`, `warning`, `border`, `ring`, or `sidebar-*`
- **THEN** it does not hardcode hex/rgb/oklch values in component files

#### Scenario: Typography tokens

- **WHEN** a component renders text
- **THEN** UI text uses the `font-sans` token (Geist Variable)
- **THEN** headings use the `font-heading` token (Geist Variable)
- **THEN** technical data uses the `font-mono` token (Geist Mono Variable)

#### Scenario: Radius and spacing

- **WHEN** a component uses rounded corners or spacing
- **THEN** it uses the `--radius-*` and Tailwind spacing scale, not arbitrary values

### Requirement: Dark mode

The dashboard SHALL support light and dark themes with the same token names.

#### Scenario: Dark theme

- **WHEN** the `.dark` class is active
- **THEN** all color tokens have dark values
- **THEN** contrast remains AA

#### Scenario: Theme persistence

- **WHEN** the user changes the theme
- **THEN** the choice persists across reloads

### Requirement: Component catalog

The dashboard SHALL use the documented shadcn/ui component set.

#### Scenario: Allowed components

- **WHEN** a new screen is built
- **THEN** it uses button, input, label, field, select, card, table, tabs, dialog, sheet,
  sidebar, badge, alert, tooltip, separator, or skeleton
- **THEN** new primitives require documentation

#### Scenario: Icons

- **WHEN** an icon is needed
- **THEN** it comes from Remixicon
- **THEN** icon-only buttons include `aria-label`

#### Scenario: Utilities

- **WHEN** class names are composed
- **THEN** the `cn()` helper is used instead of string concatenation

### Requirement: Design system documentation

The project SHALL document the design system.

#### Scenario: Documentation file

- **WHEN** a developer opens `docs/design-system.md`
- **THEN** they find tokens, typography, spacing, components, do/don’t, and examples

#### Scenario: Legacy styles

- **WHEN** legacy classes in `App.css` are found
- **THEN** they are migrated to tokens/utilities or documented as an exception
