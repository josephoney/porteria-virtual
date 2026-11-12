# Design: error boundary del dashboard

## Context

React 18 desmonta el árbol completo cuando un componente lanza durante el render y no hay un `ErrorBoundary` arriba. Este dashboard no tenía ninguno, así que cualquier `TypeError` en un `useMemo`, un acceso a un campo nulo o un `map` sobre una forma inesperada se traducía en `<body>` vacío.

El caso real: `AdminPanel` filtra unidades con `unit.code.toLowerCase()`. `location_units.code` es nullable y los nodos creados desde el diálogo de estructura no tienen código. Un solo nodo con `code = null` dejaba al admin sin app.

## Goals

- Que un error de render muestre un fallback con contexto y acciones.
- Conservar el shell (sidebar y header) cuando falla solo el contenido de la ruta.
- Recuperar la app navegando, sin recargar.
- No exponer stack traces en producción.
- Tener una prueba automática que impida volver a la pantalla blanca.

## Non-goals

- Telemetría remota de errores.
- Reintentos automáticos o backoff.
- Reemplazar el manejo de errores de carga existente.
- Capturar errores de código asíncrono fuera del render.

## Decisions

### 1. Un componente, dos montajes

`ErrorBoundary` es una clase (los boundaries lo requieren: `getDerivedStateFromError` y `componentDidCatch` no tienen equivalente en hooks) con estas props:

```ts
interface ErrorBoundaryProps {
  children: ReactNode;
  resetKey?: string;
  fullPage?: boolean;
  title?: string;
}
```

Se monta dos veces:

1. **`DashboardLayout`**, envolviendo solo el `<Outlet />`. El sidebar y el header quedan fuera, así el usuario ve la app funcionando con un panel de error en el contenido y puede irse a otra sección.
2. **`DashboardApp`**, envolviendo `<Routes>` con `fullPage`. Cubre `/login`, `/invite/:token`, `/c/:slug` y el caso en que falle el shell. Sin este segundo montaje, un error en `AppSidebar` seguiría dando pantalla blanca.

El boundary interno atrapa primero, así que el caso normal no escala al de página completa.

### 2. Reset por clave, no por remontaje

El boundary recibe `resetKey={pathname}`. En `componentDidUpdate`, si la clave cambió y hay error, limpia el estado. Es más barato y menos destructivo que forzar un remontaje con `key`, y permite que un error en `/admin` no sobreviva al salto a `/admin/users`.

### 3. El fallback no depende del shell

El fallback usa solo `Button` y tokens del tema (`bg-background`, `bg-card`, `border-border`, `text-muted-foreground`). No usa `PageHeader` ni componentes del layout, porque uno de los escenarios es justamente que el layout sea el que falló.

Acciones:

- **Reintentar**: limpia el estado del boundary y vuelve a renderizar. Si el dato sigue mal, el boundary atrapa de nuevo; no hay loop porque no es automático.
- **Recargar**: `window.location.reload()`, para el caso en que el estado de la app quedó corrupto.

### 4. Detalle técnico solo en desarrollo

`import.meta.env.DEV` decide si se muestran `error.message` y el stack. En producción se muestra el mensaje y un texto genérico, sin rutas internas ni nombres de componentes.

`componentDidCatch` hace `console.error` con `componentStack` en todos los entornos: es lo único que queda para diagnosticar desde la consola del navegador de un usuario.

### 5. Cómo se prueba

El test no necesita inyectar código en la app: intercepta `GET /api/communities` y devuelve `{ "oops": true }`. `AdminPanel` guarda ese objeto como si fuera un array y el `useMemo` de filtros explota al llamar `.filter`. Es exactamente la clase de fallo que dejaba la pantalla en blanco, pero reproducible en un test.

## Risks

- Un boundary demasiado arriba oculta errores en desarrollo. Mitigación: el stack se muestra en dev y `componentDidCatch` siempre loguea.
- Si el error ocurre en un efecto y no en render, el boundary no lo ve. Es una limitación conocida de React; esos casos siguen necesitando `try/catch`.
- Reintentar sin cambiar el dato vuelve a fallar. Es intencional: el fallback no finge que se arregló.
- El fallback dentro del layout depende de que el sidebar no haya sido la causa; para ese caso está el boundary de página completa.
