# Theme System — shadcn

El dashboard usa el contrato de tema de shadcn con Tailwind CSS 4. El objetivo es que
puedas pegar un tema generado/descargado desde shadcn y que **todo** el dashboard cambie
sin tocar componentes.

## Archivos

- `apps/dashboard/src/styles/theme.css`: única fuente de colores, radios y fuentes.
- `apps/dashboard/src/main.tsx`: importa `theme.css` antes de `index.css`.
- `apps/dashboard/src/index.css`: importa Tailwind y Fontsource, y mapea las variables
  con `@theme inline`.
- `apps/dashboard/scripts/check-theme.mjs`: valida que no haya colores/fuentes crudas
  fuera de `theme.css`.

## Probar temas sin romper nada

Usá el wrapper del proyecto:

```bash
pnpm --filter @porteria/dashboard theme:apply <preset-code|registry-url>
```

Ejemplo con un preset code:

```bash
pnpm --filter @porteria/dashboard theme:apply b870VEw0in
```

Ejemplo con una URL de registry (tweakcn / shadcnthemer):

```bash
pnpm --filter @porteria/dashboard theme:apply "https://shadcnthemer.com/r/themes/<id>.json"
```

El wrapper detecta si el argumento es una URL:

- **preset code** → `shadcn apply --preset <code> --only theme`;
- **URL** → `shadcn add <url>`.

En ambos casos el CLI escribe en `src/index.css` y el wrapper mueve `:root` / `.dark` a
`src/styles/theme.css`.

El wrapper:

1. hace backup de `theme.css`, `index.css`, `components.json` y `package.json`;
2. aplica **solo `--only theme`** (o `add <url>` si es un registry);
3. mueve `:root` y `.dark` a `src/styles/theme.css`;
4. conserva `--warning`, `--destructive-foreground` y las fuentes;
5. restaura `index.css`, `components.json` y `package.json`;
6. corre `check:theme` y `tsc --noEmit`;
7. si algo falla, restaura el backup automáticamente.

No cambia componentes, iconos ni tipografía. Para tipografía, usá `--only font` por
separado y revisá el diff. **Nunca uses el preset completo para probar temas**: puede
sobrescribir `components/ui/*` y los iconos.

### Presets de referencia

| Código       | Estilo | Base  | Tema    | Charts  | Iconos    | Fuente    | Heading     | Radio   | Estado            |
| ------------ | ------ | ----- | ------- | ------- | --------- | --------- | ----------- | ------- | ----------------- |
| `b870VEw0in` | luma   | mist  | cyan    | lime    | remixicon | Noto Sans | EB Garamond | small   | Reemplazado       |
| `b3Zheoix4U` | sera   | stone | emerald | cyan    | phosphor  | Oxanium   | Geist       | default | Probado solo tema |
| `b23AN4K`    | nova   | taupe | neutral | neutral | lucide    | Manrope   | inherit     | default | Base anterior     |

Tema actual: **Starry Night (tweakcn)**, aplicado desde
`https://shadcnthemer.com/r/themes/4b37c294-9f6f-4979-b68d-715d34684e56.json` con
`theme:apply`. Aporta colores y radios; la tipografía se resolvió aparte con
**Geist Variable** + **Geist Mono Variable** vía Fontsource.

Para ver un preset antes de aplicarlo:

```bash
pnpm dlx shadcn@latest preset decode <code>
```

Para abrirlo en el navegador:

```bash
pnpm dlx shadcn@latest preset open <code>
```

### Restaurar un tema anterior

Cada `theme:apply` imprime una ruta de backup. Para volver atrás:

```bash
Copy-Item "C:\Users\Usuario\AppData\Local\Temp\porteria-theme-<timestamp>\theme.css" `
  "apps\dashboard\src\styles\theme.css" -Force
pnpm --filter @porteria/dashboard check:theme
```

Los backups están en `%TEMP%` y pueden limpiarse. Si un tema es importante, copiá su
`theme.css` a `docs/` antes de borrar el backup.

## Aplicar un preset con el CLI manualmente

Desde la raíz del monorepo:

```bash
pnpm dlx shadcn@latest apply --preset <code> -c apps/dashboard --only theme
```

Para tema + tipografía:

```bash
pnpm dlx shadcn@latest apply --preset <code> -c apps/dashboard --only theme,font
```

No uses el preset completo en este proyecto: también puede sobrescribir componentes,
iconos y configuración. `--only` acepta `theme` y `font`.

El CLI escribe las variables en `src/index.css` porque `components.json` apunta ahí.
Después de aplicarlo:

1. Mové el bloque `:root` y `.dark` generado a `src/styles/theme.css`.
2. Dejá `src/index.css` solo con imports, `@theme inline` y `@layer base`.
3. Agregá los tokens propios que el preset no traiga:
   `--warning`, `--warning-foreground`, `--warning-bg`, `--destructive-foreground`.
4. Corré `pnpm --filter @porteria/dashboard check:theme`.

## Cómo aplicar un tema de shadcn manualmente

1. Generá o descargá el tema desde la página de themes de shadcn.
2. Reemplazá el contenido de `src/styles/theme.css` por el CSS del tema.
3. Verificá que existan estas variables en `:root` y `.dark`:
   - `--background`, `--foreground`
   - `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`
   - `--destructive`, `--warning`
   - `--border`, `--input`, `--ring`
   - `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`,
     `--sidebar-border`, `--sidebar-ring`
   - `--radius`
4. Definí las fuentes en `theme.css`. Si el tema trae familias propias, apuntá los
   tokens; si no, elegí una familia self-hosted con `@fontsource` (nunca Google
   Fonts en runtime):
   ```css
   --font-ui: <familia o stack para UI>;
   --font-heading-font: <familia o stack para títulos>;
   --font-code: <familia o stack para datos técnicos>;
   --font-sans: var(--font-ui);
   --font-heading: var(--font-heading-font);
   --font-mono: var(--font-code);
   ```
   La app usa `Geist Variable` para UI/títulos y `Geist Mono Variable` para datos
   técnicos, ambas instaladas con `@fontsource-variable/*`.
5. Corré:
   ```bash
   pnpm --filter @porteria/dashboard check:theme
   pnpm --filter @porteria/dashboard exec tsc --noEmit
   ```
6. Revisá claro/oscuro y contraste en `/login`, `/platform`, `/admin` y `/analysis`.

## Mapeo `theme.css` → Tailwind

`index.css` declara:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  /* ... */
  --font-sans: var(--font-ui);
  --font-heading: var(--font-heading-font);
  --font-mono: var(--font-code);
  --radius-lg: var(--radius);
}
```

Eso habilita utilidades como `bg-background`, `text-foreground`, `border-border`,
`bg-primary`, `font-sans`, `font-heading` y `font-mono`.

## Tipografía

- UI y títulos: **Geist Variable**, self-hosted con `@fontsource-variable/geist`.
- Datos técnicos: **Geist Mono Variable**, self-hosted con
  `@fontsource-variable/geist-mono`.
- Las familias viven en `theme.css` (`--font-ui`, `--font-heading-font`,
  `--font-code`). Para otra tipografía, cargala con `@fontsource` y apuntá esos
  tokens; no uses Google Fonts en runtime.

## Validación

```bash
pnpm --filter @porteria/dashboard check:theme
```

Falla si encuentra:

- colores hex, `rgb()` u `oklch()` fuera de `theme.css`;
- `font-family` cruda fuera de `theme.css`;
- imports de Google Fonts.

Las excepciones, si alguna vez son inevitables, deben documentarse acá y en el código.

## Alineación con dashboard-01

El dashboard usa el esquema de `dashboard-01` adaptado a nuestra app:

- `SiteHeader` con breadcrumb y trigger del sidebar.
- `SectionCards` para métricas.
- `ChartAreaInteractive` con datos reales de `/api/reports/event-breakdown`.
- Patrón `DataTable` con `Table`, `ListToolbar` y `Pagination`.
- `NavUser` en el footer del sidebar.

No se copiaron datos demo ni se agregaron Tabler, dnd o TanStack. Se mantiene luma +
Remixicon + Geist / Geist Mono (Fontsource).

## Dark mode

- `.dark` define todos los tokens.
- `NavUser` aplica el tema desde el menú de usuario y persiste la elección en `localStorage`
  (`porteria-theme`).
- Toda pantalla nueva debe revisarse en claro y oscuro.

## Alcance

Este sistema es build-time. No hay selección runtime ni branding por organización. Si
más adelante se necesita un tema por tenant, va como change separado con persistencia,
validación de contraste y caché.
