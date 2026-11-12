## Why

El MVP ya tiene la funcionalidad principal, pero la experiencia de administración todavía no está lista para demos ni para un piloto: el login es una pantalla genérica, la tabla de usuarios no permite encontrar personas rápido ni refleja bien los usuarios multicomunidad, y el detalle de una comunidad está escondido detrás de un botón y no muestra la estructura física.

## What Changes

- **Login/signup con identidad visual**: página de autenticación en dos columnas, con la imagen `fondo_contacto.png`, el logo `LogoZima_W.svg`, el texto “Zima Seguridad” y “Sistema Portería virtual y accesos”. Incluye tabs **Iniciar sesión** / **Crear cuenta**; el alta sigue siendo por invitación o por comunidad, no autoregistro abierto.
- **Tabla de usuarios operable**: filtros por correo, nombre, documento y estado; contador de usuarios según el alcance (organización o comunidad); columna **Comunidad** antes de **Membresía**; una fila por membresía con celdas de usuario fusionadas con `rowSpan`; acciones de membresía con dos íconos horizontales; estado global del usuario como botón verde/rojo.
- **Detalle de comunidad desplegable**: se elimina el botón **Detalle**; la fila completa se expande y contrae. El detalle incluye los datos actuales y un resumen de estructura (“3 torres de 5 pisos, 3 apartamentos por piso. 45 apartamentos en total.”).
- **Tokens de éxito del tema**: se agregan `--success` y `--success-foreground` al tema para el estado activo, sin colores crudos en componentes.

## Capabilities

### New Capabilities

- `branded-login`: layout de autenticación en dos columnas, marca, tabs login/signup, selección de contexto y comportamiento responsive.
- `users-table-filters`: filtros server-side, contadores por alcance, columnas compactas, `rowSpan` multicomunidad, acciones de membresía y estado global.
- `community-detail-expansion`: expansión de fila, detalle de comunidad y resumen de estructura.

### Modified Capabilities

- Ninguna.

## Impact

- `apps/dashboard/src/pages/LoginPage.tsx`
- `apps/dashboard/src/components/login-form.tsx`
- `apps/dashboard/src/components/layout/` (nuevo shell de autenticación)
- `apps/dashboard/src/components/admin/UsersTable.tsx`
- `apps/dashboard/src/components/admin/AdminPanel.tsx`
- `apps/dashboard/src/components/layout/StructureTreeDialog.tsx`
- `apps/dashboard/src/styles/theme.css` y `apps/dashboard/src/index.css`
- `server/api/src/routes/users.routes.ts` y `server/api/src/services/users.service.ts`
- `server/api/src/routes/communities.routes.ts` (resumen de estructura en `GET /:id/overview`)
- `packages/shared/src/dto/` y `packages/shared/src/types/` si cambian los contratos
- Tests de integración de API y Playwright del dashboard

## Fuera de alcance

- Autoregistro sin invitación ni validación de comunidad.
- Nuevo backend de autenticación, OAuth, MFA o recuperación de contraseña.
- Acciones masivas, exportación CSV o página de detalle de usuario.
- Cambios al modelo de membresías, roles o permisos.
- App móvil Zima.
