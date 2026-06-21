## Context

El dashboard usa CSS plano (373 líneas en `App.css`) con custom properties y estilos inline en componentes React. No hay sistema de componentes — cada tabla, badge, botón y select reinventa su propio estilo. shadcn-ui ofrece componentes accesibles basados en Radix primitives, con theming vía CSS variables que mapea directamente a los tokens existentes. Los componentes se copian al proyecto, no son un package opaco.

## Goals / Non-Goals

**Goals:**
- Instalar Tailwind CSS v4 + shadcn-ui con tema que preserve la identidad visual actual
- Migrar los 4 componentes admin de prioridad alta a shadcn-ui (UsersTable, CallHistoryTable, BitacoraView, ReportsPanel)
- Migrar LoginPage a shadcn-ui (Card, Input, Button, Alert)
- Reemplazar badges y botones en Sidebar, TopBar y EventLog con componentes shadcn
- Eliminar estilos inline y clases CSS reemplazadas por shadcn

**Non-Goals:**
- Migrar el panel del operador (CallQueue, KioskList, VideoPanel) — tienen identidad visual propia de "call center"
- Migrar IncomingCallOverlay — componente nuevo con su propio diseño
- Cambiar la estructura de layout (CSS Grid se mantiene)
- Usar shadcn CLI (los componentes se agregan manualmente, sin dependencia de tooling externo)

## Decisions

### 1. Tailwind CSS v4 (no v3)

**Decisión**: Usar Tailwind CSS v4 con configuración CSS-based (`@theme` en `index.css`), no JS-based (`tailwind.config.ts`). V4 es la versión actual y tiene mejor rendimiento, integración nativa con Vite, y simplifica la configuración.

**Alternativa considerada**: Tailwind v3 con `tailwind.config.ts`. Se descartó porque v4 es el estándar actual y shadcn-ui ya lo soporta.

### 2. Componentes shadcn agregados manualmente (no CLI)

**Decisión**: Copiar los componentes shadcn necesarios a `components/ui/` manualmente desde la documentación oficial. No usar `npx shadcn-ui@latest add`.

**Razón**: El CLI de shadcn asume una estructura de proyecto específica (Next.js, alias `@/`). Nuestro proyecto usa Vite + React con su propia estructura. Agregar componentes manualmente da control total y evita dependencia del CLI.

### 3. Migración progresiva, no big bang

**Decisión**: Migrar componente por componente, manteniendo el CSS legacy funcional. Cada componente migrado elimina sus estilos inline/clases del `App.css`.

**Orden de migración**:
1. Setup (Tailwind, theme, cn util, componentes base)
2. LoginPage (componente simple, buen punto de entrada)
3. UsersTable (el más complejo, sienta las bases)
4. CallHistoryTable (similar a UsersTable, reusa patrones)
5. BitacoraView (agrega Collapsible y Skeleton)
6. ReportsPanel (agrega Tabs y Card)
7. Sidebar/TopBar/EventLog (cambios mínimos, Badge + Button)

### 4. Theme via CSS custom properties

**Decisión**: Definir el tema en `index.css` usando el bloque `@theme` de Tailwind v4:

```css
@import "tailwindcss";

@theme {
  --color-background: #f5f4ef;
  --color-foreground: #1a1916;
  --color-card: #ffffff;
  --color-border: #dddbd2;
  --color-primary: #1d7a4f;
  --color-destructive: #c0392b;
  --font-sans: 'Syne', sans-serif;
  --font-mono: 'IBM Plex Mono', monospace;
  --radius: 0.375rem;
}
```

Esto mapea directamente los tokens de `App.css` y es lo que shadcn-ui espera.

### 5. Fuentes: mantener Google Fonts CDN, no local

**Decisión**: Mantener el `@import` de Google Fonts en `App.css` ya que funciona y no agrega complejidad de build. Tailwind las referencia vía `font-family` en el theme.

## Risks / Trade-offs

- **[Riesgo] Tailwind aumenta el tamaño de build** → Mitigación: Tailwind v4 con JIT solo incluye las clases usadas (~3-5KB gzipped). Las dependencias de shadcn (Radix) agregan ~20KB gzipped total.
- **[Riesgo] Convivencia CSS legacy + Tailwind puede causar conflictos de especificidad** → Mitigación: El orden de carga de Vite asegura que Tailwind se procesa primero. Las clases CSS legacy se eliminan progresivamente al migrar cada componente.
- **[Trade-off] No usar shadcn CLI** → Perdemos la conveniencia de `npx shadcn add`, pero ganamos control total y evitamos dependencia de tooling que asume Next.js.
- **[Trade-off] No migrar panel operador** → El panel operador tiene un diseño muy específico de call center que no se beneficia tanto de shadcn. Postergar su migración reduce el riesgo y acelera el MVP.

## Open Questions

- ¿Conviene usar `tailwind-merge` con preset de shadcn o el básico? Se usará el básico con `clsx` — suficiente para el alcance actual.
- ¿Migrar `IncomingCallOverlay` a shadcn? No en este change — es un componente nuevo con su propio diseño que ya funciona bien.
