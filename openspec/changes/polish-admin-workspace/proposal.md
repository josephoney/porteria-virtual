## Why

El dashboard funciona, pero un administrador no puede saber con certeza en qué organización o comunidad está trabajando. El encabezado del sidebar y el header muestran siempre "Portería Virtual", y la landing de cada rol no saluda ni nombra el contexto activo. Un `org_admin` que administra varias organizaciones, o un `community_admin` que entra desde una invitación, no tiene ninguna señal visual de dónde está parado.

Al mismo tiempo, las pantallas de detalle arrastran tres problemas de legibilidad:

- En **Mi Organización** la carga de logo usa un `<input type="file">` visible que parece un campo de texto, y el recuadro del logo no centra su placeholder.
- Los detalles expandibles mezclan etiqueta y valor con el mismo peso visual, así que "Tipo: conjunto" se lee como una sola frase.
- En **Organizaciones** de plataforma el detalle está detrás de un botón "Ver detalle", cuando en **Comunidades** ya se resuelve con click en la fila. Dos patrones distintos para la misma tarea.

Nada de esto rompe la funcionalidad, pero sí la confianza en una demo y en un piloto con administradores reales.

## What Changes

- **Contexto de trabajo visible**: el encabezado del sidebar muestra el nombre y el logo de la organización para `org_admin`, y el nombre y logo de la comunidad para `community_admin`, `operator` y `guard`. El administrador de plataforma sigue viendo "Portería Virtual" con el ícono de plataforma.
- **Bienvenida como toast**: al entrar al dashboard aparece un toast centrado arriba con "Bienvenido, {nombre}" y el nombre de la organización o comunidad activa; se oculta solo a los 5 segundos y no se repite en la sesión. Las páginas de resumen dejan de mostrar el bloque fijo de bienvenida.
- **Logo como botón**: en Mi Organización y en el detalle de comunidad, la carga de logo pasa a un botón "Elegir logo" / "Cambiar logo" con input oculto. El placeholder "Sin logo" queda centrado.
- **Nombre destacado**: el nombre de la organización en Mi Organización y el de la comunidad en su detalle usan `text-base font-bold` (+2px sobre `text-sm`).
- **Detalles legibles**: se crea `DetailGrid`/`DetailField` con etiqueta chica en mayúsculas y valor en `text-sm font-medium`, y se aplica a todos los detalles expandibles.
- **Fila expandible y Editar**: en Organizaciones de plataforma se elimina "Ver detalle"; la fila expande y contrae con click o teclado. En Comunidades se agrega "Editar" reutilizando el formulario existente contra `PATCH /api/communities/:id`.

## Capabilities

### New Capabilities

- `workspace-context`: identidad de la organización o comunidad activa en el shell y toast de bienvenida al entrar al dashboard.
- `organization-profile-ui`: carga de logo como botón, placeholder centrado y jerarquía del nombre.
- `detail-card-consistency`: componente compartido de detalle, filas expandibles por click y acciones de fila consistentes.

### Modified Capabilities

- Ninguna. El cambio es de UI del dashboard; no modifica contratos de API ni el modelo de datos.

## Impact

- `apps/dashboard/src/components/layout/AppSidebar.tsx`
- `apps/dashboard/src/components/layout/SiteHeader.tsx`
- `apps/dashboard/src/components/layout/DashboardLayout.tsx`
- `apps/dashboard/src/contexts/` (nuevo `WorkspaceContext.tsx`)
- `apps/dashboard/src/lib/` (nuevo `use-expanded-row.ts`)
- `apps/dashboard/src/components/ui/detail-field.tsx` (nuevo)
- `apps/dashboard/src/components/layout/WorkspaceWelcomeToast.tsx` (nuevo)
- `apps/dashboard/src/pages/MyOrganizationPage.tsx`
- `apps/dashboard/src/pages/PlatformPage.tsx`
- `apps/dashboard/src/pages/AnalysisPage.tsx` y las landings de operador y guardia
- `apps/dashboard/src/components/admin/AdminPanel.tsx`
- `apps/dashboard/src/components/operator/`
- Tests Playwright del dashboard

## Dependencias

- El botón **Editar** de Organizaciones en plataforma abre el diálogo que entrega `extend-organization-profile`. Este cambio solo retira "Ver detalle" y deja la fila expandible; no agrega una acción muerta.

## Fuera de alcance

- Cambiar el modelo de membresías, roles o permisos.
- Persistir la organización o comunidad activa en el servidor, o agregar un selector multi-contexto.
- Editar el nombre de la organización desde Mi Organización (`PATCH /api/organizations/me` no acepta `name`).
- Endpoints nuevos de API.
- Rediseño del login o de la app móvil.
