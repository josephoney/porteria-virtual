## Why

El dashboard ya tiene tokens y no tiene colores hardcodeados en componentes, pero los
tokens viven directo en `@theme` y no siguen el contrato estándar de shadcn
(`:root` + `.dark` + `@theme inline`). Eso hace que pegar un tema generado/descargado de
shadcn no aplique todo automáticamente y que tipografía, radios y colores no tengan un
único origen reemplazable.

## What Changes

- Adoptar el contrato de tema de shadcn:
  - `theme.css` con variables en `:root` y `.dark`;
  - `@theme inline` para mapear esas variables a utilidades Tailwind;
  - un único lugar para colores, radios y fuentes crudas.
- Parametrizar tipografía con `--font-sans`, `--font-heading` y `--font-mono`, usando
  Fontsource (sin Google Fonts en runtime).
- Garantizar que ningún componente tenga hex/rgb/oklch ni familias de fuente
  hardcodeadas.
- Agregar un script de validación que falle si aparece un color/fuente fuera de
  `theme.css`.
- Documentar cómo generar/descargar un tema de shadcn, pegarlo, mapear variables,
  verificar dark mode y contraste.
- Mantener el tema como **build-time**: se cambia el archivo y se recompila.
- Alinear el shell del dashboard con el block `dashboard-01` de shadcn:
  `SiteHeader`, `SectionCards`, `ChartAreaInteractive` y el patrón `DataTable`, usando
  datos reales, luma y Remixicon. Sin datos demo, Tabler, dnd ni TanStack.
- **Non-goals:** no se implementa selección runtime de temas, ni branding por tenant, ni
  cambios de API/DB.

## Capabilities

### New Capabilities

- `theme-system`: contrato shadcn, archivo de tema, tipografía parametrizada,
  validación de hardcodeos, dark mode y documentación.

## Impact

- **Dashboard**: `src/index.css`, nuevo `src/styles/theme.css`, `docs/design-system.md`
  y documentación de tema.
- **Scripts**: validador de tokens/hardcodeos.
- **Sin cambios de API/DB.**
- **Depende de:** `standardize-dashboard-ux` (tokens, componentes y docs base).
- **Prioridad:** P1, después de estabilizar la consola administrativa.
