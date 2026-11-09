## MODIFIED Requirements

### Requirement: Call history design consistency

The call history table SHALL use the shared design system.

#### Scenario: Shared components
- **WHEN** the call history table is rendered
- **THEN** it uses the shared `Table`, `Button`, `Badge` and `Select` components
- **THEN** it uses semantic tokens for color, spacing and borders
- **THEN** it does not use legacy class names or hardcoded colors

### Requirement: Admin panel design consistency

The admin panel SHALL follow the shared design system in light and dark mode.

#### Scenario: Same design system
- **WHEN** the admin panel is rendered
- **THEN** it uses the same semantic color, typography and radius tokens as the rest of
  the dashboard
- **THEN** it uses `font-sans` for UI and `font-mono` for technical data
- **THEN** it has no hardcoded colors, font families or legacy visual aliases
- **THEN** it remains legible in both light and dark mode
