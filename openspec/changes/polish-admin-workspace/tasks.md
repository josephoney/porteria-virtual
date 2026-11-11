# Tasks

## 1. Contexto de trabajo

- [x] 1.1 Crear `apps/dashboard/src/contexts/WorkspaceContext.tsx` con `WorkspaceProvider` y `useWorkspace()`; resolver `kind`, `id`, `name`, `logoAssetId` y `logoUrl` a partir de `useAuth()`.
- [x] 1.2 Resolver el nombre y el logo con `GET /api/organizations/me` para `org_admin` y con `GET /api/communities/:communityId/overview` para `community_admin`, `operator` y `guard`; plataforma usa la constante "Portería Virtual".
- [x] 1.3 Exponer `refresh()` y revalidar cuando cambia `activeMembership.id`.
- [x] 1.4 Resolver el logo dentro del provider con `assetObjectUrl` y revocar el object URL al desmontar o cambiar de workspace. No se creó un hook aparte: `MyOrganizationPage` y el detalle de comunidad resuelven su propio preview porque muestran el asset antes de que el provider revalide.
- [x] 1.5 Envolver `DashboardLayout` con `WorkspaceProvider`.
- [x] 1.6 Reemplazar el fetch propio y el texto fijo de `AppSidebar` por `useWorkspace()`; mostrar logo o ícono de fallback (`RiGovernmentLine` para plataforma, `RiBuilding2Line` para tenant) y truncar nombres largos con `title`.
- [ ] 1.7 Verificar en el navegador que no queden requests duplicados de marca al navegar entre rutas.

## 2. Bienvenida

- [x] 2.1 Crear `apps/dashboard/src/components/layout/WorkspaceWelcomeToast.tsx` con "Bienvenido, {nombre}" y el nombre del workspace como contexto.
- [x] 2.2 Fallback a `user.email` cuando `user.name` está vacío.
- [x] 2.3 Mostrar el toast centrado arriba (`fixed left-1/2 top-6 -translate-x-1/2`), con `role="status"`, `aria-live="polite"` y `pointer-events-none`.
- [x] 2.4 Auto-cerrar a los 5 segundos con animación de salida de 200 ms (`animate-out fade-out slide-out-to-top-4`).
- [x] 2.5 Mostrarlo una sola vez por sesión de navegador y por workspace, con la clave `porteria_welcome_toast:{userId}:{kind}:{id}` en `sessionStorage`.
- [x] 2.6 Esperar a que `useWorkspace()` resuelva antes de mostrarlo, para no saludar sin contexto.
- [x] 2.7 Montarlo una sola vez en `DashboardLayout` y quitar el bloque fijo de `PlatformPage`, `AdminPanel`, `GuardPanel` y `OperatorPanel`.

## 3. Logo y jerarquía del nombre

- [x] 3.1 Crear `apps/dashboard/src/components/ui/logo-upload.tsx` con input oculto + `Button variant="outline"` y texto "Elegir logo" / "Cambiar logo"; usarlo en `MyOrganizationPage`.
- [x] 3.2 Validar MIME (PNG/JPG/WEBP) y tamaño máximo 500 KB antes de llamar a `/api/assets`; mostrar el nombre del archivo y el error inline.
- [x] 3.3 Centrar el placeholder "Sin logo" con `flex items-center justify-center text-center` y usar `object-contain` en el preview.
- [x] 3.4 Aplicar el mismo control en el detalle de comunidad de `AdminPanel` con el componente local `CommunityLogoField`.
- [x] 3.5 Cambiar el valor del campo "Organización" en `MyOrganizationPage` a `text-base font-bold` y el nombre de la comunidad en su detalle al mismo tratamiento.
- [x] 3.6 Llamar a `refresh()` del workspace después de guardar el logo para que el sidebar se actualice sin recargar.

## 4. Detalles expandibles

- [x] 4.1 Crear `apps/dashboard/src/components/ui/detail-field.tsx` con `DetailGrid` (`<dl>`) y `DetailField` (`<dt>`/`<dd>`), `span="half" | "full"` y fallback `—`.
- [x] 4.2 Crear `apps/dashboard/src/lib/use-expanded-row.ts` con `expandedId`, `isExpanded`, `toggle`, `collapse` y `expandableRowProps`.
- [x] 4.3 Migrar el detalle de organización de `PlatformPage` a `DetailGrid`/`DetailField` y eliminar los prefijos `NIT:`, `Teléfono:` y `Dirección:` del valor.
- [x] 4.4 Migrar el detalle de comunidad de `AdminPanel` a `DetailGrid`/`DetailField`.
- [x] 4.5 Migrar el resumen de `MyOrganizationPage` al mismo componente.
- [x] 4.6 En Organizaciones de plataforma, quitar el botón "Ver detalle"/"Ocultar detalle" y hacer la fila expandible con `role="button"`, `tabIndex`, `aria-expanded`, Enter y Space.
- [x] 4.7 Usar `useExpandedRow` en Organizaciones y Comunidades para que solo haya una fila abierta.
- [x] 4.8 Agregar "Editar" a las acciones de comunidad: modo `edit` en `communityForm` que precarga datos y hace `PATCH /api/communities/:id`.
- [x] 4.9 Asegurar `stopPropagation` en "Editar", "Invitar admin" y "Ver estructura" para que no cambien la expansión.
- [x] 4.10 Agregar "Editar" a las acciones de organización con diálogo de nombre y slug contra `PATCH /api/platform/organizations/:id`. El cambio de administrador y la geografía llegan en `extend-organization-profile`.
- [x] 4.11 Revisar que ninguna tabla con detalle conserve un botón de detalle propio. Verificado: no quedan referencias a `Ver detalle`/`Ocultar detalle` en `apps/dashboard/src`.

## 5. Tests y verificación

- [ ] 5.1 Playwright: `org_admin` ve el nombre y logo de su organización en el sidebar; `guard` ve el de su comunidad; plataforma ve "Portería Virtual".
- [ ] 5.2 Playwright: al entrar al dashboard aparece el toast "Bienvenido, {nombre}" con el workspace, desaparece a los 5 s y no vuelve al navegar; ninguna landing muestra el bloque fijo.
- [ ] 5.3 Playwright: en Mi Organización el control de logo es un botón, el placeholder está centrado y el nombre de la organización usa `text-base font-bold`.
- [ ] 5.4 Playwright: click en la fila de una organización expande el detalle; segundo click lo contrae; Enter también lo alterna; solo una fila abierta.
- [ ] 5.5 Playwright: "Editar" de comunidad abre el formulario precargado sin colapsar la fila y guarda los cambios.
- [ ] 5.6 Verificar etiqueta y valor del detalle en modo claro y oscuro.
- [x] 5.7 `pnpm --filter @porteria/dashboard exec tsc --noEmit`, lint, Prettier y `check:theme`.
- [x] 5.8 `pnpm exec openspec validate polish-admin-workspace --strict`.
- [x] 5.9 Playwright: estado activo del sidebar (`tests/navigation.spec.ts`). Las rutas raíz (`/`, `/guard`, `/platform`, `/admin`) solo se subrayan con match exacto; las de sección usan prefijo por segmento. Cubre "Resumen" pegado en subrutas y la colisión `/analysis/bitacora` vs `/analysis/bitacora-accesos`. Verifica que `data-active` y `aria-current="page"` coincidan y haya un solo ítem activo. Verificado que los tres casos fallan con la lógica anterior.
