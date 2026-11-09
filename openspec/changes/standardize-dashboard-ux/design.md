## Context

El dashboard usa Tailwind CSS 4, shadcn/ui (Radix), Remixicon, Geist y Geist Mono. Los
tokens están en `src/index.css`, pero `App.css` conserva variables y clases legacy. No
hay documentación ni catálogo, y algunas pantallas usan estilos ad-hoc.

## Goals / Non-Goals

**Goals:**

- Una fuente única de tokens y componentes.
- Consistencia visual y de interacción.
- Accesibilidad y responsive.
- Documentación reutilizable por los equipos.

**Non-Goals:**

- No se cambia la lógica de negocio.
- No se introduce otra librería de componentes.
- No se rediseña el kiosk ni la app Expo (solo se documentan sus tokens base).

## Decisions

### 1. Tailwind 4 + shadcn/ui como base

**Decisión:** mantener Tailwind 4 y shadcn/ui. No agregar otra librería. Los componentes
shadcn se copian/ajustan en `components/ui` y se consumen con `cn()`.

### 2. Tokens en `index.css`

**Decisión:** todos los colores, radios, fuentes y sombras viven en `@theme` de
`index.css`. `App.css` se reduce a animaciones/scrollbar o se migra a utilidades.

### 3. Tipografía

**Decisión:** Geist Variable para UI y títulos, y Geist Mono Variable para datos técnicos (IDs, códigos,
timestamps). No se cargan fuentes desde Google Fonts en runtime; se usan los paquetes
`@fontsource-variable/geist` y `@fontsource-variable/geist-mono`.

### 4. Dark mode

**Decisión:** definir todos los tokens en `.dark`, no solo los `--*-bg`. El toggle se
documenta y se prueba en todas las pantallas.

### 5. Estados obligatorios

**Decisión:** toda pantalla con datos debe tener `loading` (skeleton), `empty` y `error`
con reintento. Las mutaciones muestran feedback y deshabilitan el botón mientras corren.

### 6. Formularios

**Decisión:** usar `Field`, `Label`, `Input`, `Select` y mensajes de error debajo del
campo. Los formularios destructivos piden confirmación.

### 7. Tablas

**Decisión:** header sticky opcional, paginación consistente, acciones a la derecha,
`aria-label` en icon buttons, estado vacío y skeleton.

### 8. Responsive

**Decisión:** breakpoints Tailwind (`sm`, `md`, `lg`, `xl`). El sidebar colapsa en mobile.
Las tablas se convierten en cards o scroll horizontal en pantallas chicas.

### 9. Accesibilidad

**Decisión:** contraste mínimo AA, foco visible (`ring`), navegación por teclado,
`aria-label` en icon-only, roles y `aria-live` para errores/toasts.

### 10. Documentación

**Decisión:** `docs/design-system.md` con tokens, ejemplos y “do/don’t”.

## Risks / Trade-offs

- **[Riesgo] Cambios visuales masivos** → Mitigación: migración por pantalla y revisión
  visual.
- **[Riesgo] Romper componentes existentes** → Mitigación: tests visuales/manuales y
  cambios incrementales.
- **[Trade-off] Sin Storybook** → Se documenta en Markdown; Storybook queda para Fase 2.
