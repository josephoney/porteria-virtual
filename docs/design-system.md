# Design System — Dashboard

Fuente única de verdad para el dashboard de Portería Virtual. El objetivo es que toda
pantalla nueva use los mismos tokens, componentes y estados sin inventar estilos
paralelos.

## Stack

- React + TypeScript.
- Tailwind CSS 4 con tokens en `apps/dashboard/src/index.css`.
- shadcn/ui + Radix en `apps/dashboard/src/components/ui`.
- Iconos Remixicon.
- Stacks tipográficos del sistema para UI, títulos y datos técnicos (definidos en `theme.css`).
- `cn()` de `src/lib/utils.ts` para componer clases.

## Tokens

Todos los colores viven en `@theme` de `index.css`. No se usan hex, `rgb()` ni `oklch()`
sueltos en componentes.

| Token                                           | Uso                              |
| ----------------------------------------------- | -------------------------------- |
| `background` / `foreground`                     | Fondo y texto base               |
| `card` / `card-foreground`                      | Tarjetas y paneles               |
| `popover` / `popover-foreground`                | Menús, tooltips y overlays       |
| `primary` / `primary-foreground`                | Acción principal y foco de marca |
| `secondary` / `secondary-foreground`            | Acción secundaria                |
| `muted` / `muted-foreground`                    | Superficies y texto de apoyo     |
| `accent` / `accent-foreground`                  | Selección y hover destacado      |
| `destructive` / `destructive-foreground`        | Errores y acciones destructivas  |
| `warning` / `warning-foreground` / `warning-bg` | Advertencias y badges            |
| `border` / `input` / `ring`                     | Bordes, controles y foco         |
| `sidebar-*`                                     | Navegación lateral               |

Radios: `--radius-lg`, `--radius-md`, `--radius-sm`. No uses `rounded-[13px]` salvo que
el componente lo requiera por geometría.

Sombras: preferí `border` + `bg-card`. Las sombras fuertes quedan reservadas para
overlays.

## Tipografía

- UI y títulos: `font-sans` / `font-heading` → **Geist Variable**, self-hosted con
  `@fontsource-variable/geist`.
- Datos técnicos (IDs, códigos, timestamps, slugs): `font-mono` → **Geist Mono
  Variable**, self-hosted con `@fontsource-variable/geist-mono`.
- Usá `font-bold tracking-tight` o `tracking-widest uppercase` para labels de
  sección.
- Las familias viven en `theme.css` (`--font-ui`, `--font-heading-font`,
  `--font-code`). Si necesitás otra tipografía, cargala con `@fontsource` y
  apuntá esos tokens a la familia; no uses Google Fonts en runtime.

## Dark mode

- Los tokens oscuros se definen en `.dark` con los mismos nombres.
- `src/lib/theme.ts` aplica el tema y persiste la elección en `localStorage`
  (`porteria-theme`).
- `NavUser` está en el footer del sidebar y permite abrir Cuenta, Notificaciones, cambiar contexto/tema y cerrar sesión.
- Todo componente nuevo debe verse bien en claro y oscuro; no uses colores fijos.
- El anillo de foco usa `--ring` a opacidad completa (`focus-visible:ring-ring`): azul
  primario en claro, dorado en oscuro. No uses `ring-ring/30` ni `/50`, porque sobre el
  fondo queda por debajo de 3:1 y el foco se vuelve invisible.

## Componentes permitidos

Catálogo en `src/components/ui`:

- `Button`: variantes `default`, `secondary`, `outline`, `ghost`, `destructive`, `link`;
  tamaños `xs`, `sm`, `default`, `lg`, `icon*`.
- `Badge`: variantes `default`, `secondary`, `destructive`, `outline`, `ghost`,
  `warning`, `link`.
- `Field`, `Label`, `Input`, `NativeSelect`, `Select`: estructura de formularios.
  `NativeSelect` (`components/ui/native-select.tsx`) es un `<select>` nativo con los
  mismos estilos que `Input`; usalo para listas cortas y fijas (país, tipo, días de
  retención) donde no hace falta el popover de Radix.
- `ConfirmDialog` (`components/ui/confirm-dialog.tsx`): confirmación accesible para
  acciones destructivas, con `pending` y variante `destructive`. El foco inicial cae en
  Cancelar para que Enter no confirme por accidente.
- `SectionCards` (`components/layout/SectionCards.tsx`): grilla estándar de métricas.
  No armes tarjetas de métrica a mano.
- `panel` (utilidad CSS en `src/index.css`): superficie de tablas y secciones
  (`rounded-4xl` + borde + `bg-card`) sin la sombra de `Card`. Usala en lugar de repetir
  `rounded-4xl border border-border bg-card`.
- `InvitationUnitChips` (`components/admin/InvitationUnitChips.tsx`): chips compactos
  de unidades para listados de invitaciones. Usa `Badge` y muestra la ruta en `title`.
- `UnitInviteSelectionBar` (`components/admin/UnitInviteSelectionBar.tsx`): barra fija
  de selección múltiple con conteo, acción principal y limpiar.
- `Card`, `Table`, `Tabs`, `Dialog`, `Sheet`, `Sidebar`, `Alert`, `Tooltip`, `Separator`,
  `Skeleton`, `Avatar`, `DropdownMenu`.
- Iconos: Remixicon. Un botón icon-only SIEMPRE lleva `aria-label`.

Si hace falta un primitivo nuevo, se agrega a `components/ui`, se documenta acá y se
justifica en el PR.

## Formularios

Patrón:

```tsx
<Field>
  <Label htmlFor="email">Email</Label>
  <Input id="email" {...fieldA11y('email', error)} />
  {error && (
    <p id="email-error" role="alert" className="text-xs text-destructive">
      {error}
    </p>
  )}
</Field>
```

Reglas:

- Label siempre visible; no uses placeholder como único label.
- Error inline debajo del campo y anunciado con `role="alert"` o `aria-live`.
- `aria-invalid` y `aria-describedby` en el control.
- Para no repetir el wiring de ARIA y las validaciones triviales, usá los helpers de
  `src/lib/form.ts`:
  - `fieldA11y(id, error)`: devuelve `aria-invalid` y `aria-describedby`
    (`<id>-error`) listos para esparcir en el control.
  - `requiredError(value, label)`, `emailError(value, label?)`,
    `minLengthError(value, min, label)`: devuelven el mensaje o `''`.
  - `hasErrors(errors)`: corta el submit cuando hay algún mensaje.
- El `id` del error SIEMPRE es `<id-del-control>-error`; si hay texto de ayuda, el
  `aria-describedby` concatena ambos ids separados por espacio.
- Al escribir en el campo se limpia su error (`setErrors(prev => ({ ...prev, campo: '' }))`).
- Validá en el cliente con `noValidate` en el `<form>` para que el mensaje inline
  reemplace la burbuja nativa del navegador.
- El botón de submit se deshabilita y muestra estado pendiente mientras corre.
- Toda acción destructiva abre un `Dialog` de confirmación con copy explícito y botón
  `destructive`.

## Tablas

- Header consistente; acciones a la derecha.
- Siempre cubrir `loading` (skeleton), `empty` y `error` con reintento.
- Paginación muestra página/total y deshabilita extremos.
- En mobile: scroll horizontal o cards; nunca columnas aplastadas.
- Fechas y IDs con `font-mono`; estados con `Badge`.
- Icon buttons con `aria-label`.

## Layout

- Shell: `Sidebar` + `SiteHeader` + main.
- Desktop (`lg+`): sidebar visible; mobile: `Sheet`.
- La ruta activa se marca en el sidebar.
- El sidebar filtra por rol/contexto; el contexto de plataforma no muestra items de
  tenant.
- La top bar muestra contexto, tema, ringtone y salida.

## Accesibilidad

Checklist mínimo:

- Navegación completa por teclado.
- Foco visible con `ring` a opacidad completa (mínimo 3:1 contra el fondo).
- Contraste AA en claro y oscuro.
- `aria-label` en icon-only.
- `aria-live`/`role="alert"` para errores y toasts.
- Diálogos: foco entra al abrir, vuelve al cerrar y `Escape` cierra.
- No transmitas información solo por color.

### Contraste verificado (WCAG AA)

Medido sobre los tokens de `src/styles/theme.css` (OKLCH → sRGB → luminancia relativa):

| Par | Claro | Oscuro | Mínimo |
| --- | --- | --- | --- |
| `foreground` / `background` | 14.72 | 14.38 | 4.5 |
| `muted-foreground` / `card` | 5.44 | 4.87 | 4.5 |
| `primary-foreground` / `primary` | 6.34 | 5.06 | 4.5 |
| `accent-foreground` / `accent` | 5.77 | 10.83 | 4.5 |
| `destructive` / `card` | 12.94 | 5.35 | 4.5 |
| `success-foreground` / `success` | 5.00 | 8.86 | 4.5 |
| `ring` / `background` | 6.15 | 13.29 | 3 |

`border` e `input` quedan por debajo de 3:1 y son decorativos: los controles se
identifican por label, placeholder, relleno y anillo de foco. No los uses como única
señal de estado.

## Do / Don't

Do:

- Usá tokens (`bg-card`, `text-muted-foreground`, `border-border`).
- Usá `cn()` para combinar clases.
- Usá `font-mono` para datos técnicos.
- Documentá excepciones en este archivo.

Don't:

- No hardcodees `#111`, `rgb(...)` u `oklch(...)` en componentes.
- No importes fuentes desde Google Fonts.
- No uses `var(--secondary)` ni `var(--border)`; los tokens reales son
  `var(--color-secondary)` y `var(--color-border)`.
- No agregues otra librería de UI.
- No dupliques variantes de botón/badge con clases ad hoc.

## Legacy

`src/App.css` quedó reducido a scrollbar y animaciones. Las variables legacy
(`--bg`, `--surface`, `--green`, `--amber`, etc.) y el import de Google Fonts se
eliminaron. Si encontrás una clase legacy, migrala a tokens/utilidades o documentá la
excepción acá.
