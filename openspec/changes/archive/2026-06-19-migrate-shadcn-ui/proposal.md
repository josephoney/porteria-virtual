## Why

El dashboard actual usa CSS plano con custom properties y estilos inline en los componentes React. Si bien funciona, el código crece en complejidad visual sin consistencia: hay inline styles, clases CSS sueltas, y cada componente nuevo reinventa sus propios badges, botones y tablas. shadcn-ui ofrece componentes accesibles (Radix primitives) con un sistema de theming basado en CSS variables que mapea perfectamente a los tokens de diseño existentes (`--bg: #f5f4ef`, `--ink: #1a1916`, etc.). Además, sus componentes se copian al proyecto (no son un package opaco), permitiendo customización total sin depender de un vendor.

## What Changes

- **Instalación de Tailwind CSS v4 + shadcn-ui**: Dependencias base (`tailwindcss`, `@tailwindcss/vite`, `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`)
- **Configuración de theme**: Mapeo de los tokens de diseño actuales a variables CSS de shadcn-ui (background, foreground, primary, muted, border, etc.) preservando las fuentes Syne + IBM Plex Mono
- **Utilidad `cn()`**: Helper para combinar clases condicionales con resolución de conflictos Tailwind
- **Migración progresiva de componentes**: Por batch, empezando por los 4 de prioridad alta
- **Convivencia CSS legacy + Tailwind**: Las clases CSS existentes (`App.css`) se mantienen funcionales durante la migración. Se retiran gradualmente

## Capabilities

### New Capabilities

- `shadcn-theme`: Configuración del sistema de theming de shadcn-ui con los tokens de diseño del proyecto
- `shadcn-components`: Componentes base de shadcn-ui copiados a `components/ui/` (Button, Input, Table, Badge, Select, Dialog, Tabs, Card, etc.)

### Modified Capabilities

- `dashboard-admin`: Los componentes UsersTable, CallHistoryTable, BitacoraView y ReportsPanel migran a shadcn-ui
- `dashboard-shell`: LoginPage migra a shadcn-ui (Card, Input, Label, Button, Alert). Sidebar y TopBar reciben badges con shadcn Badge

## Impact

- **Nuevas dependencias**: `tailwindcss`, `@tailwindcss/vite`, `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`
- **Archivos nuevos**: `tailwind.config.ts` o CSS-based config (v4), `src/lib/utils.ts` (cn helper), `src/index.css` (Tailwind directives), `components/ui/*.tsx` (shadcn components)
- **Archivos modificados**: `vite.config.ts` (agregar Tailwind plugin), componentes admin, LoginPage
- **Sin cambios**: Backend, signaling, API, WebRTC, lógica de negocio
