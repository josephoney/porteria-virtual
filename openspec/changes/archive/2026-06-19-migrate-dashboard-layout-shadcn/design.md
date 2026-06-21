## Context

El layout actual usa CSS Grid (`grid-rows-[56px_1fr]` + `grid-cols-[240px_1fr]`) con un sidebar custom que maneja su propia visibilidad mobile vía estado React. El bloque Dashboard de shadcn-ui usa `SidebarProvider` para estado global del sidebar, `SidebarInset` para el contenido principal, y `Sheet` para el drawer mobile.

## Goals / Non-Goals

**Goals:**
- Adoptar la estructura `<SidebarProvider>` + `<SidebarInset>` del bloque shadcn
- Sidebar colapsable con animación (íconos + tooltips en modo colapsado)
- Soporte mobile nativo vía Sheet (drawer)
- Navegación con íconos de lucide-react
- Preservar IncomingCallOverlay, TopBar (brand, ringtone, logout)

**Non-Goals:**
- Cambiar la lógica de ruteo (React Router se mantiene)
- Agregar breadcrumbs o search (no son necesarios para este MVP)
- Migrar OperatorPanel, AdminPanel, GuardPanel

## Decisions

### 1. Componentes sidebar copiados manualmente

**Decisión**: Copiar los componentes `sidebar.tsx` desde la documentación oficial de shadcn-ui (bloque Dashboard), adaptando los imports para usar `@radix-ui/*` en vez de `radix-ui`.

**Alternativa**: Usar el componente sidebar del package `shadcn@4.11.0`. Se descartó porque ya tuvimos problemas de compatibilidad con ese package (tabs con `"use client"`, CSS roto).

### 2. SidebarTrigger en TopBar

**Decisión**: Colocar `<SidebarTrigger>` como primer elemento del TopBar (hamburger menu). En desktop colapsa/expande el sidebar. En mobile abre el Sheet.

### 3. Estructura final

```tsx
<SidebarProvider defaultOpen={true}>
  <AppSidebar />            {/* usa Sidebar + SidebarContent + SidebarFooter */}
  <SidebarInset>
    <IncomingCallOverlay />
    <TopBar />              {/* incluye SidebarTrigger */}
    <main><Outlet /></main>
  </SidebarInset>
</SidebarProvider>
```

## Risks / Trade-offs

- **[Riesgo] Sidebar de shadcn es complejo** → Mitigación: copiar solo los subcomponentes necesarios (SidebarProvider, Sidebar, SidebarTrigger, SidebarInset, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarFooter, SidebarRail). No copiar breadcrumbs, search, team switcher.
- **[Trade-off] Perdemos el control fino del grid manual** → El SidebarInset maneja el layout automáticamente con CSS variables de shadcn. Es menos flexible pero más estándar.
