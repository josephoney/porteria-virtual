## 1. New UI components

- [x] 1.1 Create `components/ui/sheet.tsx` — Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle (from @radix-ui/react-dialog / radix-ui)
- [x] 1.2 Create `components/ui/tooltip.tsx` — TooltipProvider, Tooltip, TooltipTrigger, TooltipContent (from @radix-ui/react-tooltip)
- [x] 1.3 Create `components/ui/sidebar.tsx` — SidebarProvider, Sidebar, SidebarTrigger, SidebarInset, SidebarContent, SidebarHeader, SidebarFooter, SidebarGroup, SidebarGroupLabel, SidebarGroupContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarRail
- [x] 1.4 Install missing Radix dependency: `@radix-ui/react-tooltip`

## 2. Create AppSidebar component

- [x] 2.1 Create `components/layout/AppSidebar.tsx` using shadcn sidebar primitives
- [x] 2.2 Define navigation items with lucide-react icons: `LayoutDashboard` for Operador, `ShieldCheck` for Admin, `Footprints` for Guardia
- [x] 2.3 Filter items by user role (from useAuth)
- [x] 2.4 Use `<SidebarMenuButton>` with `isActive` based on current route (useLocation)
- [x] 2.5 Add user role badge in `<SidebarFooter>` using `<Badge>`

## 3. Refactor DashboardLayout

- [x] 3.1 Wrap layout in `<SidebarProvider defaultOpen={true}>`
- [x] 3.2 Replace grid layout with `<AppSidebar>` + `<SidebarInset>`
- [x] 3.3 Move `<IncomingCallOverlay />` inside `<SidebarInset>` (above TopBar)
- [x] 3.4 Pass TopBar props to integrate `<SidebarTrigger>`

## 4. Refactor TopBar

- [x] 4.1 Move TopBar inside `<SidebarInset>` as `<header>`
- [x] 4.2 Add `<SidebarTrigger>` as the first element (hamburger icon)
- [x] 4.3 Add `<Separator orientation="vertical" />` after trigger
- [x] 4.4 Keep brand, RingtoneSelector, user badge, and logout button

## 5. Cleanup

- [x] 5.1 Remove old `Sidebar.tsx` (replaced by AppSidebar)
- [x] 5.2 Remove sidebar-related Tailwind classes from DashboardLayout (the grid layout)
- [x] 5.3 Update App.tsx imports if needed

## 6. Verification

- [ ] 6.1 Desktop: sidebar visible with icons + labels, navigation works
- [ ] 6.2 Collapse: sidebar collapses to icons only, tooltips show on hover
- [ ] 6.3 Mobile: hamburger opens Sheet overlay, backdrop closes it
- [ ] 6.4 Role filtering: admin sees all 3 items, operator sees only Operador
- [ ] 6.5 Active route highlighted in sidebar
- [ ] 6.6 IncomingCallOverlay still works above all content
- [ ] 6.7 TopBar brand and user info preserved
