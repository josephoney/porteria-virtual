## Why

El dashboard ya usa React + Tailwind CSS 4 + shadcn/ui + Remixicon, pero no tiene un Design
System documentado ni una estructura UX consistente: conviven tokens nuevos (OKLCH) con
estilos legacy en `App.css`, el dark mode está incompleto, hay etiquetas mezcladas
español/inglés, faltan estados de carga/error homogéneos y algunos controles no son
accesibles. Antes de sumar pantallas administrativas nuevas hay que fijar estándares.

## What Changes

- Documentar y consolidar los **Design Tokens** (color, tipografía, radios, spacing,
  sombras) en un único lugar.
- Definir el catálogo de **componentes shadcn/ui** y sus variantes permitidas.
- Estandarizar:
  - layout del dashboard, sidebar y top bar;
  - formularios (Field/Label/Input/Select/errores);
  - tablas (paginación, vacío, loading, acciones);
  - tarjetas y métricas;
  - modales/diálogos y confirmaciones destructivas;
  - botones (primario, secundario, ghost, destructive) e icon-only con `aria-label`;
  - colores, tipografía y dark mode;
  - responsive (mobile, tablet, desktop);
  - accesibilidad (focus, contraste, teclado, labels).
- Eliminar o migrar estilos legacy de `App.css` que no sigan los tokens.
- Crear `docs/design-system.md` con ejemplos de uso.
- **Non-goals:** no se rediseña la lógica de negocio ni el backend; no se introduce otra
  librería de UI.

## Capabilities

### New Capabilities

- `design-system-foundations`: tokens, tipografía, color, iconografía, dark mode y
  catálogo de componentes.
- `dashboard-ux-standards`: layout, sidebar, formularios, tablas, tarjetas, modales,
  botones, responsive y accesibilidad.

### Modified Capabilities

- Ninguna. La propuesta es de UI/documentación y no cambia contratos del backend.

## Impact

- **Dashboard**: `src/index.css`, `App.css`, `components/ui/*`, layout, pantallas.
- **Documentación**: nuevo `docs/design-system.md`.
- **Sin cambios de API/DB.**
- **Dependencias:** ninguna. Puede definirse en paralelo, pero se aplica después de
  estabilizar las pantallas de la jerarquía administrativa.
