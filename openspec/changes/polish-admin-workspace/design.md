# Design: contexto de trabajo y detalles legibles

## Context

`DashboardLayout` compone `AppSidebar`, `SiteHeader` y el `Outlet`. El sidebar ya intenta mostrar una marca: `AppSidebar` hace un fetch propio a `GET /api/organizations/me` o `GET /api/communities/:id/overview`, resuelve el `logoAssetId` con `assetObjectUrl` y lo pinta junto a un texto fijo "Portería Virtual". Es decir: el logo cambia, el nombre no. Ese texto fijo es la raíz del problema de orientación.

`AuthContext` expone `user`, `activeMembership` y `memberships`, pero no los nombres. `ActiveMembership` solo tiene ids (`organizationId`, `communityId`), así que cualquier componente que quiera mostrar el nombre debe resolverlo por su cuenta. Hoy lo hace el sidebar, y nadie más.

En paralelo, los detalles expandibles se escribieron a mano en cada pantalla. `PlatformPage` usa `<p>` con clase `text-xs font-medium uppercase tracking-wider text-muted-foreground` para la etiqueta y `<p>` sin clase para el valor, pero también mete valores con prefijo (`NIT: ...`, `Teléfono: ...`) en el mismo bloque, así que la jerarquía se pierde. `AdminPanel` hace lo mismo en el detalle de comunidad. No hay un componente compartido.

## Goals

- Que el usuario sepa, en cualquier pantalla, en qué organización o comunidad está trabajando.
- Que el dashboard salude y nombre ese contexto al entrar, sin ocupar espacio permanente en las páginas.
- Un solo componente de detalle para todos los pares etiqueta/valor.
- Un solo patrón de fila expandible en todas las tablas con detalle.
- Carga de logo con affordance de botón y placeholder centrado.

## Non-goals

- Nuevo endpoint de contexto o de "workspace".
- Selector de contexto múltiple o cambio de organización desde el header.
- Persistencia del contexto activo en el servidor.
- Cambios en `SiteHeader` más allá de lo necesario para el nombre del workspace (los breadcrumbs siguen como están).
- Edición del nombre de la organización desde Mi Organización.

## Decisions

### 1. El workspace se deriva de la sesión, sin endpoint nuevo

`WorkspaceProvider` envuelve `DashboardLayout`, consume `useAuth()` y resuelve un objeto:

```ts
interface Workspace {
  kind: 'platform' | 'organization' | 'community';
  id: string | null;
  name: string;
  logoAssetId: string | null;
  role: string | null;
}
```

Reglas de resolución:

| Rol activo                                | Origen de datos                              | `name`              |
| ----------------------------------------- | -------------------------------------------- | ------------------- |
| `isPlatformAdmin` sin membresía de tenant | constante                                    | "Portería Virtual"  |
| `org_admin`                               | `GET /api/organizations/me`                  | `organization.name` |
| `community_admin`, `operator`, `guard`    | `GET /api/communities/:communityId/overview` | `community.name`    |

Los datos ya existen en ambos endpoints. No se agrega API nueva ni se toca el contrato v1.

La caché vive en el provider y se invalida cuando cambia `activeMembership.id` (login, cambio de contexto, logout). El provider expone `refresh()` para que Mi Organización y la carga de logo puedan revalidar el nombre o el logo después de guardar.

### 2. El logo se resuelve una sola vez, en el provider

Los assets son privados: el navegador no puede usar el `logoAssetId` como `src`. Se pide el blob con `assetObjectUrl` y se revierte el object URL al desmontar o al cambiar de logo. Ese patrón hoy vive dentro de `AppSidebar`; se extrae a `useBrandLogo(logoAssetId)` en `apps/dashboard/src/lib/use-brand-logo.ts` y se elimina el fetch duplicado del sidebar.

Consecuencia: un solo request de marca por sesión, no uno por componente.

### 3. El saludo es un toast efímero, no un bloque de página

Un bloque fijo "Bienvenido, ..." compite con el `PageHeader` de cada pantalla y se repite cada vez que el usuario vuelve al resumen. Se reemplaza por `WorkspaceWelcomeToast`, montado una sola vez en `DashboardLayout`:

- Centrado arriba: `fixed left-1/2 top-6 -translate-x-1/2`, ancho máximo `24rem`.
- `role="status"` + `aria-live="polite"`, y `pointer-events-none` para que nunca bloquee clicks.
- Entrada con `animate-in fade-in slide-in-from-top-4` y salida con `animate-out fade-out slide-out-to-top-4` (de `tw-animate-css`, ya importado en `index.css`).
- Se oculta solo a los 5 segundos (`SHOW_MS`) con una animación de salida de 200 ms (`EXIT_MS`).
- Se muestra una sola vez por sesión de navegador y por workspace, con la clave `porteria_welcome_toast:{userId}:{kind}:{id}` en `sessionStorage`. Navegar entre rutas no lo repite; recargar en la misma sesión tampoco.
- El nombre sale de `user.name` con fallback a `user.email`; el contexto es el nombre del workspace, o "Plataforma" para el administrador de plataforma.
- Espera a que `useWorkspace()` resuelva (`isLoading === false` y `name` no vacío) para no mostrar un saludo sin contexto.

No se agrega una librería de toasts: el repo no tiene `sonner` ni un `Toaster` montado, y una dependencia nueva no se justifica para un solo mensaje. Si más adelante aparecen más notificaciones, este componente se reemplaza por `sonner` sin tocar el resto.

### 4. `DetailGrid` y `DetailField` con semántica de lista de definición

`apps/dashboard/src/components/ui/detail-field.tsx`:

```tsx
<DetailGrid columns={2}>
  <DetailField label="Tipo" value={community.type} />
  <DetailField label="Dirección" value={community.address} span="full" />
</DetailGrid>
```

- `DetailGrid` renderiza `<dl>` con `grid gap-x-6 gap-y-4`; `md:grid-cols-2` por defecto, `md:grid-cols-3` cuando se pide.
- `DetailField` renderiza `<div>` con `<dt>` (etiqueta) y `<dd>` (valor), porque un `<div>` dentro de `<dl>` es HTML válido desde HTML5 y permite agrupar.
- Etiqueta: `text-xs font-medium uppercase tracking-wider text-muted-foreground`.
- Valor: `text-sm font-medium text-foreground`, con `break-words` para direcciones y mensajes largos.
- `span="full"` aplica `md:col-span-2` (o el ancho total de la grilla).
- Valor vacío o `null` → `—`. Un solo lugar define ese fallback, no cada pantalla.

Se aplica a: detalle de organización en `/platform`, detalle de comunidad en `/admin`, resumen de Mi Organización y cualquier tarjeta expandible con pares etiqueta/valor.

### 5. Un hook para la fila expandible

`apps/dashboard/src/lib/use-expanded-row.ts`:

```ts
function useExpandedRow<T extends string>() {
  const [expandedId, setExpandedId] = useState<T | null>(null);
  return {
    expandedId,
    isExpanded: (id: T) => expandedId === id,
    toggle: (id: T) => setExpandedId((current) => (current === id ? null : id)),
    collapse: () => setExpandedId(null),
  };
}
```

El patrón de accesibilidad ya está implementado en `AdminPanel` para comunidades y se replica en `PlatformPage`:

- `role="button"`, `tabIndex={0}`, `aria-expanded`, `aria-controls`.
- Enter y Space disparan el toggle; Space hace `preventDefault` para no scrollear.
- `onClick` en el `TableRow`; las acciones internas usan `event.stopPropagation()`.
- Una sola fila expandida a la vez.

### 6. Carga de logo: input oculto más botón

```tsx
<input
  ref={inputRef}
  type="file"
  accept="image/png,image/jpeg,image/webp"
  className="sr-only"
  onChange={handleFile}
/>
<Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
  <RiUpload2Line /> {hasLogo ? 'Cambiar logo' : 'Elegir logo'}
</Button>
```

Validación en cliente antes de subir: MIME dentro de `image/png`, `image/jpeg`, `image/webp` y tamaño `<= 500 * 1024` bytes. Si falla, no se llama a `/api/assets` y se muestra el error inline. Se conserva el flujo actual: `POST /api/assets` con `kind` (`organization_logo` o `community_logo`) y luego el `PATCH` del recurso con `logoAssetId`.

El recuadro de preview usa `flex items-center justify-center text-center` y, cuando hay logo, `object-contain` para no deformar imágenes con otra relación de aspecto.

### 7. "Editar" comunidad reutiliza el formulario existente

`communityForm` en `AdminPanel` pasa a tener modo `create | edit`. En modo edición precarga los valores de la comunidad, cambia el título del diálogo a "Editar comunidad" y hace `PATCH /api/communities/:id` (endpoint existente, rol `org_admin` o `community_admin`) en lugar de `POST /api/organizations/me/communities`.

Para organizaciones, este cambio no agrega el botón "Editar": el diálogo depende de `PATCH /api/platform/organizations/:id` con `administratorEmail`, que entrega `extend-organization-profile`. Agregar un botón que no hace nada sería peor que no tenerlo.

### 8. Nombre destacado

`text-base font-bold` (+2px sobre `text-sm`, mismo `font-bold` que el usuario pidió). Se aplica al valor del campo "Organización" en `MyOrganizationPage` y al nombre de la comunidad en su detalle. La etiqueta queda `text-xs uppercase text-muted-foreground`.

## Risks

- **Doble fetch de marca**: si `AppSidebar` mantiene su propio `useEffect`, se piden los assets dos veces. Mitigación: el provider es el único dueño del logo y el sidebar consume `useWorkspace()`.
- **Flash de nombre vacío**: entre el login y la respuesta del overview, el header no tiene nombre. Mitigación: mostrar el fallback por rol ("Organización" / "Comunidad") o un `Skeleton` de una línea, nunca el texto "Portería Virtual" para un tenant.
- **Nombres largos**: `truncate` en el sidebar y `title` con el nombre completo.
- **Click en fila contra acciones internas**: cualquier botón o link dentro de la fila debe llamar `stopPropagation`, incluidos los futuros.
- **`user.name` vacío** en sesiones migradas: el saludo cae al email.
- **`role="button"` en `<tr>`** no es un patrón nativo; se mantiene por consistencia con el detalle de comunidades ya implementado y se documenta la limitación (el foco visible se aplica a la fila).
