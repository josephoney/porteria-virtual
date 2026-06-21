## 1. Setup Tailwind CSS + shadcn-ui

- [x] 1.1 Install dependencies: `tailwindcss`, `@tailwindcss/vite`, `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
- [x] 1.2 Configure `@tailwindcss/vite` plugin in `vite.config.ts`
- [x] 1.3 Create `src/index.css` with Tailwind directives (`@import "tailwindcss"`) and `@theme` block mapping design tokens to CSS variables
- [x] 1.4 Create `src/lib/utils.ts` with `cn()` utility using `clsx` and `tailwind-merge`
- [x] 1.5 Verify Tailwind classes work in dev mode (`className="bg-background text-foreground"`)

## 2. Configure theme to match design tokens

- [x] 2.1 Map color tokens: `--background: #f5f4ef`, `--foreground: #1a1916`, `--card: #ffffff`, `--border: #dddbd2`, `--muted: #8a8880`
- [x] 2.2 Map semantic tokens: `--primary: #1d7a4f` (green), `--destructive: #c0392b` (red), `--warning: #c47a00` (amber), `--secondary: #1a5fa8` (blue)
- [x] 2.3 Configure fonts: `--font-sans: 'Syne', sans-serif`, `--font-mono: 'IBM Plex Mono', monospace`
- [x] 2.4 Set border radius: `--radius: 0.375rem` and apply via `@theme` block
- [x] 2.5 Verify theme renders correctly: shadcn components match existing visual identity

## 3. Generate shadcn-ui base components

- [x] 3.1 Add shadcn `button` component (`components/ui/button.tsx`)
- [x] 3.2 Add shadcn `input` component (`components/ui/input.tsx`)
- [x] 3.3 Add shadcn `table` components (`components/ui/table.tsx`)
- [x] 3.4 Add shadcn `badge` component (`components/ui/badge.tsx`)
- [x] 3.5 Add shadcn `select` component (`components/ui/select.tsx`)
- [x] 3.6 Add shadcn `dialog` component (`components/ui/dialog.tsx`)
- [x] 3.7 Add shadcn `tabs` component (`components/ui/tabs.tsx`)
- [x] 3.8 Add shadcn `card` component (`components/ui/card.tsx`)
- [x] 3.9 Add shadcn `label` component (`components/ui/label.tsx`)
- [x] 3.10 Add shadcn `skeleton` component (`components/ui/skeleton.tsx`)
- [x] 3.11 Add shadcn `alert` component (`components/ui/alert.tsx`)

## 4. Migrate LoginPage

- [x] 4.1 Replace `.login-card` div with `<Card>` + `<CardHeader>` + `<CardContent>`
- [x] 4.2 Replace `<input>` with `<Input>` and add `<Label>` for email/password fields
- [x] 4.3 Replace `<button>` with `<Button>` supporting loading state (spinner)
- [x] 4.4 Replace `.login-error` div with `<Alert variant="destructive">`
- [x] 4.5 Remove `.login-*` CSS classes from App.css after migration

## 5. Migrate UsersTable

- [x] 5.1 Replace `<table>` with `<Table>`, `<TableHeader>`, `<TableBody>`, `<TableRow>`, `<TableCell>`, `<TableHead>`
- [x] 5.2 Replace role `<select>` with shadcn `<Select>` (both inline per-row and form)
- [x] 5.3 Replace role `<span>` badges with `<Badge>` using variant mapping (admin=default, operator=secondary, guard=warning, resident=outline)
- [x] 5.4 Replace active toggle button with `<Button variant="ghost">`
- [x] 5.5 Replace pagination buttons with `<Button variant="outline" size="sm">`
- [x] 5.6 Move "Nuevo Usuario" form to `<Dialog>` with `<DialogTrigger>`, `<DialogContent>`, `<DialogHeader>`, `<DialogTitle>`
- [x] 5.7 Replace form inputs with shadcn `<Input>` and `<Label>`
- [x] 5.8 Remove inline styles from UsersTable after migration

## 6. Migrate CallHistoryTable

- [x] 6.1 Replace `<table>` with shadcn `<Table>` components
- [x] 6.2 Replace status filter `<select>` with shadcn `<Select>`
- [x] 6.3 Replace status `<span>` badges with `<Badge>` using variant mapping
- [x] 6.4 Replace pagination buttons with shadcn `<Button variant="outline">`
- [x] 6.5 Style date inputs with shadcn `<Input type="date">`
- [x] 6.6 Remove inline styles from CallHistoryTable after migration

## 7. Migrate BitacoraView

- [x] 7.1 Replace `<table>` with shadcn `<Table>` components
- [x] 7.2 Replace event type `<span>` badges with `<Badge>` using variant mapping
- [x] 7.3 Replace event type filter `<select>` with shadcn `<Select>`
- [x] 7.4 Replace date inputs with shadcn `<Input type="date">`
- [x] 7.5 Replace expandable metadata row with shadcn Collapsible/Accordion pattern
- [x] 7.6 Replace "Cargando..." text with `<Skeleton>` rows during loading
- [x] 7.7 Replace pagination buttons with shadcn `<Button variant="outline">`
- [x] 7.8 Remove inline styles and `STATUS_BADGES` map from BitacoraView

## 8. Migrate ReportsPanel

- [x] 8.1 Replace diario/semanal/mensual buttons with shadcn `<Tabs>`, `<TabsList>`, `<TabsTrigger>`
- [x] 8.2 Replace MetricCard inline styles with shadcn `<Card>` components
- [x] 8.3 Replace "Cargar" button with shadcn `<Button>` with loading state
- [x] 8.4 Replace date inputs with shadcn `<Input type="date/month">`
- [x] 8.5 Replace desglose diario `<table>` with shadcn `<Table>`
- [x] 8.6 Remove inline styles from ReportsPanel and MetricCard

## 9. Migrate Sidebar + TopBar + EventLog

- [x] 9.1 Replace Sidebar role badge with shadcn `<Badge>`
- [x] 9.2 Replace TopBar logout button with shadcn `<Button variant="ghost">`
- [x] 9.3 Replace EventLog type badges with shadcn `<Badge>` variants

## 10. Cleanup CSS legacy

- [ ] 10.1 Remove migrated CSS classes from App.css (`.login-*`, admin table styles, badge styles replaced by shadcn)
- [ ] 10.2 Keep layout classes (`.topbar`, `.sidebar`, `.main`, `.content`, `.panel-layout`) until full migration
- [ ] 10.3 Keep operator-specific classes (`.call-card`, `.kiosk-item`, `.video-*`, `.event-log`, `.incoming-toast`) as they haven't been migrated

## 11. Verification

- [ ] 11.1 Visual regression: Login page matches design (Card, Input, Button styling)
- [ ] 11.2 Visual regression: Admin panel components match design (Tables, Badges, Selects, Tabs)
- [ ] 11.3 Functional: User creation via Dialog works (create, validation errors)
- [ ] 11.4 Functional: Role change via Select works in UsersTable
- [ ] 11.5 Functional: CallHistoryTable filters and pagination work
- [ ] 11.6 Functional: BitacoraView expand/collapse, filters, pagination work
- [ ] 11.7 Functional: ReportsPanel tabs, charts, metric cards render correctly
- [ ] 11.8 No console errors from missing Tailwind classes or broken imports
- [ ] 11.9 Existing CSS classes still work (operator panel, video, kiosk list unaffected)
