## ADDED Requirements

### Requirement: Base shadcn-ui components available
The project SHALL have shadcn-ui base components in `apps/dashboard/src/components/ui/`.

#### Scenario: Button component
- **WHEN** a developer imports `Button` from `@/components/ui/button`
- **THEN** the component supports variants: `default`, `destructive`, `outline`, `secondary`, `ghost`, `link`
- **THEN** it supports sizes: `default`, `sm`, `lg`, `icon`
- **THEN** it renders a `<button>` with Tailwind classes and Radix Slot for `asChild`

#### Scenario: Input component
- **WHEN** a developer uses `<Input />` from shadcn-ui
- **THEN** it renders a styled `<input>` with focus ring, border, and padding matching the design system

#### Scenario: Table components
- **WHEN** Table, TableHeader, TableBody, TableRow, TableCell, TableHead are used
- **THEN** they render semantic `<table>` elements with hover states, border styling, and proper spacing

#### Scenario: Badge component
- **WHEN** `<Badge variant="default">Admin</Badge>` is rendered
- **THEN** it shows a colored pill matching the design system badge colors
- **THEN** variants include: `default`, `secondary`, `destructive`, `outline`

### Requirement: Interactive components available
The project SHALL have select, dialog, tabs, and card components from shadcn-ui.

#### Scenario: Select component
- **WHEN** `<Select>` is used with `<SelectTrigger>`, `<SelectContent>`, and `<SelectItem>`
- **THEN** it renders an accessible dropdown with keyboard navigation and proper ARIA attributes

#### Scenario: Dialog component
- **WHEN** `<Dialog>` is used for modals (e.g., user creation form)
- **THEN** it renders a centered overlay with backdrop, close button, and focus trap

#### Scenario: Tabs component
- **WHEN** `<Tabs>` is used with `<TabsList>` and `<TabsTrigger>`
- **THEN** it renders accessible tab navigation with active state styling

#### Scenario: Card component
- **WHEN** `<Card>` is used with `<CardHeader>`, `<CardContent>`
- **THEN** it renders a styled container with border, shadow, and proper padding
