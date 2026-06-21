## Why

El layout actual del dashboard usa CSS Grid con clases Tailwind manuales y un sidebar custom. Si bien funciona, no aprovecha los componentes `Sidebar*` de shadcn-ui, que ofrecen colapso animado, soporte mobile nativo vía Sheet, tooltips en modo colapsado, y una estructura estandarizada. Migrar al bloque Dashboard de shadcn permite que todo el layout — no solo los componentes internos — se beneficie del sistema de theming y accesibilidad de shadcn.

## What Changes

- **Nuevo componente `AppSidebar`**: Reemplaza el Sidebar actual con `SidebarProvider`, `Sidebar`, `SidebarContent`, `SidebarHeader`, `SidebarTrigger`, `SidebarRail`, `SidebarInset`
- **Nuevo UI `sidebar.tsx`**: Componentes base del sidebar de shadcn copiados a `components/ui/`
- **Nuevo UI `tooltip.tsx`**: Requerido para los items del sidebar en modo colapsado
- **Nuevo UI `sheet.tsx`**: Requerido para mostrar el sidebar como drawer en mobile
- **Refactor `DashboardLayout.tsx`**: Adopta la estructura `<SidebarProvider>` + `<SidebarInset>` en vez del grid manual
- **Refactor `TopBar.tsx`**: Pasa a estar dentro de `<SidebarInset>` en vez de ser independiente
- **Simplificación del Sidebar actual**: Los NavLink se reemplazan por items del sidebar de shadcn con íconos de lucide-react

## Capabilities

### New Capabilities

- `shadcn-sidebar-layout`: Layout del dashboard usando los componentes Sidebar* de shadcn-ui con colapso, mobile sheet y tooltips

### Modified Capabilities

- `dashboard-shell`: TopBar y Sidebar se integran en la estructura SidebarProvider/SidebarInset

## Impact

- **Nuevos archivos**: `components/ui/sidebar.tsx`, `components/ui/sheet.tsx`, `components/ui/tooltip.tsx`, `components/layout/AppSidebar.tsx`
- **Modificados**: `DashboardLayout.tsx`, `TopBar.tsx`
- **Eliminado**: `Sidebar.tsx` (reemplazado por `AppSidebar.tsx`)
- **Sin cambios**: IncomingCallOverlay, OperatorPanel, AdminPanel, GuardPanel, LoginPage, backend
