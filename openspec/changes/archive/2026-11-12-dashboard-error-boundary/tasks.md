# Tasks

## 1. Componente

- [x] 1.1 Crear `apps/dashboard/src/components/errors/ErrorBoundary.tsx` como clase con `getDerivedStateFromError` y `componentDidCatch`.
- [x] 1.2 Implementar el fallback: título “Algo salió mal”, mensaje del error, acciones “Reintentar” y “Recargar”.
- [x] 1.3 Mostrar el stack solo cuando `import.meta.env.DEV`; usar únicamente tokens del tema para los colores.
- [x] 1.4 Limpiar el estado del boundary cuando cambia `resetKey` en `componentDidUpdate`.
- [x] 1.5 Registrar el error en consola con `componentStack` en todos los entornos.

## 2. Montaje

- [x] 2.1 Envolver el `<Outlet />` de `DashboardLayout` con `resetKey={pathname}`.
- [x] 2.2 Envolver `<Routes>` en `DashboardApp` con `fullPage` y `resetKey={pathname}`.
- [x] 2.3 Verificar que el boundary interno atrapa primero y el externo queda solo para fallos del shell.

## 3. Tests y verificación

- [x] 3.1 Playwright: interceptar `/api/communities` con una forma inválida y verificar que aparece el fallback, no una pantalla en blanco.
- [x] 3.2 Playwright: verificar que el sidebar sigue visible con el fallback de ruta.
- [x] 3.3 Playwright: navegar a otra sección limpia el error (se suelta el mock antes de navegar, porque el mismo payload roto volvería a fallar).
- [x] 3.4 `pnpm --filter @porteria/dashboard exec tsc --noEmit`, lint, Prettier y `check:theme`.
- [x] 3.5 `pnpm exec openspec validate dashboard-error-boundary --strict`.
