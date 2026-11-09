## Context

Hoy `apps/dashboard/src/index.css` define `--color-*`, `--font-*` y radios directamente
en `@theme`. Los componentes usan utilidades semánticas y ya no tienen colores
hardcodeados, pero el archivo no sigue el contrato estándar de shadcn. Un tema
descargado de shadcn normalmente trae `:root` y `.dark` con variables como
`--background`, `--foreground`, `--primary`, etc., y el proyecto las mapea con
`@theme inline`.

## Goals / Non-Goals

**Goals:**

- Un solo archivo de tema reemplazable.
- Contrato estándar shadcn para colores, radios y fuentes.
- Tipografía parametrizada con Fontsource.
- Cero hardcodeos en componentes y validación automática.
- Documentación reproducible para cambiar el tema.
- Alinear el shell del dashboard con la composición de `dashboard-01`.

**Non-Goals:**

- No se implementa un selector runtime de temas.
- No se implementa branding por organización/comunidad.
- No se agrega otra librería de UI.
- No se rediseña la lógica de negocio ni pantallas fuera del shell del dashboard.

## Decisions

### 1. Tema build-time

**Decisión:** el tema se define en un archivo CSS y se aplica al compilar. Para cambiar
colores/fuentes, se reemplaza `theme.css` con el tema generado/descargado de shadcn y se
recompila.

**Alternativas:** runtime global o por tenant. Se descartan por ahora: agregan API/DB,
caché, FOUC y validación de contraste sin ser necesarios para el objetivo actual.

### 2. Contrato shadcn

**Decisión:** `src/styles/theme.css` contiene:

- `:root { ... }` con variables semánticas;
- `.dark { ... }` con los mismos nombres;
- `--radius`, `--font-sans`, `--font-heading`, `--font-mono`.

`src/index.css` importa `theme.css` y declara `@theme inline`:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... */
  --font-sans: var(--font-sans);
  --font-heading: var(--font-heading);
  --font-mono: var(--font-mono);
}
```

**Alternativas:** mantener `--color-*` directo en `@theme`. Se descarta porque un tema
shadcn no se puede pegar sin traducción manual.

### 3. Fuente única de valores crudos

**Decisión:** solo `theme.css` puede tener hex/rgb/oklch y familias de fuente. Los
componentes usan utilidades semánticas (`bg-background`, `text-foreground`,
`border-border`, `font-sans`, `font-mono`).

### 4. Tipografía

**Decisión:** Noto Sans para UI, EB Garamond para títulos e IBM Plex Mono para datos,
cargadas con Fontsource. Si el tema cambia la tipografía, se reemplazan los imports de
Fontsource y las variables de fuente; no se tocan componentes.

### 5. Validación

**Decisión:** agregar un script (`pnpm check:theme` o equivalente) que:

- falle si hay `#hex`, `rgb(`, `oklch(` fuera de `theme.css`;
- falle si hay `font-family` hardcodeada fuera del tema;
- falle si hay imports de Google Fonts;
- permita excepciones documentadas.

### 6. Dark mode

**Decisión:** `.dark` define todos los tokens; el toggle existente persiste la elección.
El tema debe mantener contraste AA en claro y oscuro.

### 7. Documentación

**Decisión:** `docs/theme-system.md` explica:

1. generar/descargar el tema en shadcn;
2. pegar el CSS en `theme.css`;
3. mapear variables faltantes en `@theme inline`;
4. reemplazar fuentes Fontsource si cambian;
5. correr la validación y revisar dark mode/contraste.

### 8. Alcance

**Decisión:** dashboard primero. Kiosk y app residente pueden adoptar los mismos tokens
en un change posterior, porque tienen restricciones de tamaño/contraste distintas.

### 9. Alineación con dashboard-01

**Decisión:** adaptar el esquema visual de `dashboard-01` sin copiar su implementación:

- `SiteHeader` con breadcrumb, trigger del sidebar y acciones.
- `SectionCards` para métricas.
- `ChartAreaInteractive` con Recharts y datos de `/api/reports/event-breakdown`.
- `DataTable` usando nuestro patrón `Table` + `ListToolbar` + `Pagination`.
- `NavUser` en el footer del sidebar.

No se agregan Tabler, dnd, TanStack ni datos demo. Se mantiene luma + Remixicon.

## Risks / Trade-offs

- **[Riesgo] Regresión visual al migrar** → Mitigación: migración incremental y revisión
  de todas las pantallas en claro/oscuro.
- **[Riesgo] Tema shadcn sin tipografía** → Mitigación: documentar que las fuentes se
  configuran aparte y viven en el mismo `theme.css`.
- **[Trade-off] Sin branding por tenant** → Si se necesita, será un change separado con
  API/DB y validación de contraste.
- **[Riesgo] Hardcodeos ocultos** → Mitigación: script de validación en CI/lint.
