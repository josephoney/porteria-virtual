# Design: Polish del dashboard para el MVP

## Contexto

El MVP ya tiene autenticación, jerarquía de ubicaciones, usuarios, membresías y bitácora. Para las pruebas y la presentación faltan tres piezas de experiencia:

- `apps/dashboard/src/pages/LoginPage.tsx` y `components/login-form.tsx` usan una sola columna centrada, sin marca ni imagen.
- `components/admin/UsersTable.tsx` lista usuarios sin filtros, sin columna de comunidad y con las membresías apiladas dentro de una sola fila.
- `components/admin/AdminPanel.tsx` usa un botón “Detalle” para desplegar la comunidad; `components/layout/StructureTreeDialog.tsx` renderiza una tarjeta por cada `location_structure`, lo que produce la duplicación “Estructura principal” / “Estructura 2”.

El cambio `single-location-structure` resuelve la duplicación de estructuras. Este cambio se enfoca en la marca, la tabla de usuarios y el detalle de comunidad.

## Objetivos

1. Login/signup con una cáscara de marca en dos columnas, usando `fondo_contacto.png` y `LogoZima_W.svg`.
2. Tabla de usuarios con búsqueda por correo/nombre/documento, filtro por estado, conteo por alcance, columna Comunidad, membresías compactas y estado global.
3. Detalle de comunidad por click en la fila, con resumen de estructura.
4. Tokens `--success` / `--success-foreground` para el estado activo, sin colores crudos.

## No objetivos

- Autorregistro abierto, OAuth, MFA o recuperación de contraseña.
- Cambios al modelo de membresías o a la asignación de roles.
- Página de detalle de usuario.
- Acciones masivas o exportación.
- Cambios en la app Zima.

## Decisiones

### 1. Cáscara de autenticación con marca

- La página de login y la de invitación comparten un componente `AuthShell`.
- En `>= 1024px`: dos columnas, izquierda 55% y derecha 45%.
  - Izquierda: `fondo_contacto.png` con `object-cover`, overlay del theme para legibilidad, `LogoZima_W.svg`, título **“Zima Seguridad”** y subtítulo **“Sistema Portería virtual y accesos”**.
  - Derecha: fondo `bg-background`, tarjeta `max-w-md`, tabs **“Iniciar sesión”** / **“Crear cuenta”**.
- En `< 1024px`: la izquierda se convierte en un hero de 180–220px; el formulario va debajo; sin scroll horizontal.
- Los assets se copian a `apps/dashboard/public/brand/`:
  - `fondo_contacto.png`
  - `LogoZima_W.svg`
  - El código referencia `/brand/fondo_contacto.png` y `/brand/LogoZima_W.svg`; nunca `../../images/` del repo.
- El overlay usa tokens del theme (`bg-background/70`, `from-background`), no colores crudos.
- El estado de selección de contexto y la pantalla `/invite/:token` usan la misma cáscara.

### 2. Login y signup

- **Iniciar sesión**: el formulario actual (email, contraseña, slug de comunidad opcional).
- **Crear cuenta**: no es autorregistro abierto. Muestra un campo de token de invitación y, si la URL es `/invite/:token`, lo precarga y bloquea el email.
  - Si no hay token: mensaje “Pedí una invitación a tu administrador.”
  - Si hay token: reutiliza el flujo existente de aceptación de invitación (`/invite/:token`).
- Un solo formulario visible a la vez; el tab activo se refleja en la URL (`?mode=signup`) para que el flujo sea compartible.
- El formulario conserva el manejo actual de `requiresContextSelection` y el selector de contexto.

### 3. Tabla de usuarios

#### Backend

`GET /api/users` agrega:

- `search`: ILIKE sobre `users.email`, `users.name`, `people.firstName`, `people.lastName`, `people.documentNumber`.
- `status`: `active | inactive`, filtra `users.active`.
- `communityId`, `page`, `pageSize` se mantienen.
- Respuesta: `{ data, total, scopeTotal, page, pageSize }`.
  - `total`: cantidad filtrada.
  - `scopeTotal`: cantidad del alcance sin filtros de búsqueda/estado; para org_admin es toda la organización, para community_admin su comunidad, y si hay `communityId` es esa comunidad.
- El join a `people` ya existe para documento; se reutiliza.

#### UI

- Barra de filtros arriba de la tabla:
  - Input de búsqueda con placeholder “Buscar por correo, nombre o documento”.
  - Select de estado: Todos / Activos / Inactivos.
  - Botón “Limpiar”.
  - Debounce de 300–400 ms; cada cambio resetea `page` a 1.
- Conteo arriba de la tabla:
  - Sin filtros: “34 usuarios en la organización” / “15 usuarios en la comunidad”.
  - Con `communityId`: “15 usuarios en Torre Norte”.
  - Con filtros: “12 resultados de 34 usuarios”.
- Columnas: **Cuenta | Persona | Documento | Comunidad | Membresía | Estado**.
- Una fila por membresía. Para usuarios multicomunidad:
  - `rowSpan` en Cuenta, Persona, Documento y Estado.
  - Una fila por cada `communityId`, con su rol y su unidad.
  - Si no tiene membresías, una sola fila con “—” en Comunidad y Membresía.
- Columna Membresía:
  - Select de rol compacto (`size="sm"`), `PATCH /api/memberships/:id { role }`.
  - Dos iconos horizontales:
    - Agregar asignación: `RiUserAddLine`, tooltip “Agregar asignación”, abre el diálogo actual (`POST /api/memberships`).
    - Quitar asignación: `RiUserUnfollowLine`, tooltip “Quitar asignación”, `PATCH /api/memberships/:id { status: 'inactive' }`.
  - `aria-label` en cada icono; no botones de texto.
- Columna Estado:
  - Un solo control por usuario (con `rowSpan`): pill verde si `active`, rojo si inactivo.
  - Click: `PATCH /api/users/:id { active: !active }`, actualización optimista con rollback y toast de error.
  - `aria-pressed` y texto “Activo”/“Inactivo”.
  - Es el estado global de la cuenta, no el estado de la membresía.
- Densidad:
  - Filas `h-10`, celdas `py-2`, `text-sm`, `whitespace-nowrap`.
  - Select `size="sm"`, iconos `icon-xs`.
  - No se permiten tarjetas dentro de celdas.

### 4. Detalle de comunidad por fila

- Se elimina el botón “Detalle”.
- La fila completa es clickeable y accesible:
  - `role="button"`, `tabIndex={0}`, `aria-expanded`.
  - Enter/Espacio alternan.
  - Chevron rota.
- Solo una comunidad expandida a la vez.
- “Invitar admin” y “Ver estructura” hacen `stopPropagation` para no alternar la fila.
- La fila expandida conserva el detalle actual (tipo, teléfono, logo, administrador, bienvenida) y agrega el resumen de estructura.

#### Resumen de estructura

`GET /api/communities/:id/overview` agrega `structureSummary`:

```ts
{
  structureId: string;
  levelCount: 1 | 2 | 3;
  levelNames: [string] | [string, string] | [string, string, string];
  level1Count: number; // torres / raíces
  level2Count: number; // total de pisos / nodos nivel 2
  leafCount: number; // total de unidades
  uniform: boolean;
  perLevel1: Array<{ id: string; name: string; level2Count: number; leafCount: number }>;
  perLevel2: Array<{ id: string; name: string; leafCount: number }>;
} | null
```

- `uniform` es `true` si todos los nodos nivel 1 tienen la misma cantidad de hijos nivel 2 y todos los nivel 2 tienen la misma cantidad de hojas.
- Texto uniforme (3 niveles): “3 torres de 5 pisos, 3 apartamentos por piso. 45 apartamentos en total.”
- Texto uniforme (2 niveles): “3 torres de 15 apartamentos. 45 apartamentos en total.”
- Texto no uniforme: “3 torres · 15 pisos · 45 unidades”.
- Sin estructura: “Sin estructura definida” + botón “Definir estructura”.
- El cálculo se hace en el backend con una consulta agregada; el frontend solo formatea.
- Se usa `Intl.ListFormat`/pluralización simple en español; los nombres vienen de `level1Name`, `level2Name`, `level3Name`.

### 5. Tokens de estado

- `apps/dashboard/src/styles/theme.css` agrega en `:root` y `.dark`:
  - `--success`
  - `--success-foreground`
- `apps/dashboard/src/index.css` mapea en `@theme inline`:
  - `--color-success: var(--success)`
  - `--color-success-foreground: var(--success-foreground)`
- Los componentes usan `bg-success text-success-foreground` / `bg-destructive`.
- `pnpm --filter @porteria/dashboard check:theme` debe seguir verde.

## API y datos

### `GET /api/users`

Parámetros nuevos:

| Parámetro           | Tipo                   | Descripción                          |
| ------------------- | ---------------------- | ------------------------------------ |
| `search`            | string                 | correo, nombre, apellido o documento |
| `status`            | `active` \| `inactive` | estado global de la cuenta           |
| `communityId`       | uuid                   | ya existente; limita el alcance      |
| `page` / `pageSize` | number                 | ya existentes                        |

Respuesta:

```ts
{
  data: UserResult[];
  total: number;      // filtrado
  scopeTotal: number; // sin filtros de búsqueda/estado
  page: number;
  pageSize: number;
}
```

### `GET /api/communities/:id/overview`

Agrega `structureSummary` con la forma anterior. No cambia el resto del contrato.

## Riesgos y mitigaciones

- **Signup confuso**: dejar claro que “Crear cuenta” requiere invitación; no prometer autorregistro.
- **rowSpan y accesibilidad**: usar `scope="rowgroup"` en las celdas combinadas y `headers` en la tabla; probar con lector de pantalla.
- **Tabla densa**: limitar a una línea por membresía; no meter cards ni textos largos.
- **Iconos sin texto**: tooltip + `aria-label`; foco visible.
- **Resumen costoso**: una sola consulta agregada por comunidad; cachear en el frontend mientras el detalle está abierto.
- **Assets**: copiar a `public/brand` para que Vite los incluya; no referenciar la raíz del repo.
- **Theme**: `--success` debe existir en light/dark; `check:theme` falla si se usan colores crudos.

## Plan de pruebas

- Integración API:
  - búsqueda por correo, nombre, apellido y documento;
  - filtro `status=active|inactive`;
  - `total` vs `scopeTotal` para org_admin y community_admin;
  - `structureSummary` uniforme, no uniforme y nulo.
- Playwright:
  - login desktop y mobile; tabs login/signup; contexto; invitación.
  - filtros de usuarios, conteo, filas multicomunidad con `rowSpan`, iconos de asignación, toggle de estado.
  - expansión/contracción de comunidad; acciones no alternan; resumen correcto para Torre Norte.
- Unit:
  - formateador de resumen de estructura (uniforme/no uniforme/sin estructura).
- `pnpm --filter @porteria/dashboard check:theme`
- `tsc --noEmit` en dashboard y API; Prettier.

## Fuera de alcance

- Autorregistro, OAuth, MFA, recuperación de contraseña.
- Notificaciones push, subusuarios, recurrencia o bitácora avanzada.
- Cambios al modelo de membresías.
- Rediseño del resto del dashboard.
