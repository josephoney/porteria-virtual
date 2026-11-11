## Why

Un error de render en el dashboard desmonta el árbol completo de React y deja la pantalla en blanco, sin mensaje ni pista. Ya pasó: `location_units.code` es nullable, el filtro de unidades llamó `toLowerCase()` sobre `null` y el administrador de organización vio una aplicación vacía. Tardamos una sesión entera en diagnosticarlo porque una pantalla blanca no dice nada: ni qué componente falló, ni con qué dato, ni qué hacer.

En producción ese síntoma es peor: el usuario no puede recuperarse salvo recargando, y no hay forma de saber qué pasó.

## What Changes

- Nuevo `ErrorBoundary` reutilizable con fallback legible: título, mensaje, detalle técnico **solo en desarrollo**, y dos acciones: **Reintentar** y **Recargar**.
- Boundary **a nivel de ruta** en `DashboardLayout` alrededor del `<Outlet />`, para que el sidebar y el header sigan visibles y usables mientras el contenido falla.
- Boundary **a nivel de aplicación** en `DashboardApp` alrededor de `<Routes>`, para cubrir login, invitación y entrada por comunidad, donde no hay shell.
- El error se limpia al cambiar de ruta (`resetKey={pathname}`), así navegar recupera la app sin recargar.
- Test Playwright que rompe una ruta a propósito y verifica que aparece el fallback, que el shell sobrevive y que navegar limpia el error.

## Capabilities

### New Capabilities

- `dashboard-resilience`: fallback de error en lugar de pantalla blanca, reset por navegación y detalle técnico acotado a desarrollo.

### Modified Capabilities

- Ninguna.

## Impact

- `apps/dashboard/src/components/errors/ErrorBoundary.tsx` (nuevo)
- `apps/dashboard/src/App.tsx`
- `apps/dashboard/src/components/layout/DashboardLayout.tsx`
- `tests/error-boundary.spec.ts` (nuevo)

## Fuera de alcance

- Reportar el error a un servicio externo (Sentry). Va con el change de observabilidad.
- Reintentar automáticamente la petición que originó el error.
- Reemplazar los mensajes de error de carga que ya existen inline (`AdminPanel`, `PlatformPage`): esos siguen igual.
- Capturar errores en handlers asíncronos fuera de render; el boundary solo cubre render, ciclo de vida y constructores.
