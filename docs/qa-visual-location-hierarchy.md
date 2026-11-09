# QA visual — jerarquía de ubicaciones, auth y roles

Checklist para verificar visualmente la app con logins reales y datos del seed.

## Modelo de niveles

La estructura define cuántos niveles tiene y cómo se llaman. El **último nivel es siempre la unidad** (el nodo que se asocia a residentes).

Ejemplos:

| Niveles | Nivel 1 | Nivel 2 | Nivel 3 | Caso |
|---|---|---|---|---|
| 2 | Torre | Apartamento | — | Torres con apartamentos; el piso va en el código, ej. `4-403` |
| 3 | Interior | Piso | Apartamento | Interiores, pisos y apartamentos |
| 1 | Casa | — | — | El nodo raíz es la unidad |

Para el caso de 8 torres, 5 pisos y 6 apartamentos:

- **2 niveles**: creás 8 Torres y, dentro de cada Torre, 30 Apartamentos. No hay nodos de piso.
- **3 niveles**: creás 8 Torres/Interiores, 5 Pisos por cada uno y 6 Apartamentos por piso. Permite administrar pisos por separado.

## Permisos de creación

| Rol | Puede crear |
|---|---|
| Superadmin / platform admin | Organizaciones, comunidades, estructuras y nodos en cualquier comunidad |
| Org admin | Estructuras y nodos dentro de su organización; invitaciones y usuarios de su alcance |
| Community admin | Estructuras y nodos solo dentro de su comunidad |

Los residentes/tenants no crean estructura; reciben una invitación de onboarding y, cuando exista la app móvil, operan sus pases.

## Estado actual

- `add-configurable-location-hierarchy`: 28/46 tareas.
- `reorganize-admin-console`: 39/51.
- `standardize-dashboard-ux`: 22/38.
- `add-zima-qr-access-app`: 0/64. La app móvil **todavía no existe**.
- `apps/resident` es un stub. No existe `apps/zima-qr-access`.
- El dashboard redirige a los residentes a `/app-required`.

## 0. Preparación

### Servicios

```bash
docker compose up -d
docker compose ps
pnpm --filter @porteria/database db:migrate
pnpm --filter @porteria/database db:seed
pnpm dev:full
```

URLs:

- Dashboard: `http://localhost:5174`
- API: `http://localhost:3000`
- Login: `http://localhost:5174/login`
- Entrada por comunidad: `http://localhost:5174/c/torre-norte`

### Higiene de sesión

- Usar una ventana privada distinta por usuario, o limpiar `localStorage`.
- No mezclar refresh tokens ni contexto activo entre pruebas.
- Si una prueba falla por permisos, repetir en ventana limpia antes de reportar.

### Credenciales

Contraseña para todos: `porteria123`.

| Usuario | Rol / alcance | Uso |
|---|---|---|
| `superadmin@porteria.local` | Platform admin | Consola de plataforma |
| `admin@porteria.local` | Org admin de Administradora Demo | Torre Norte y Los Álamos |
| `admin2@porteria.local` | Org admin de otra organización | Aislamiento entre organizaciones |
| `communityadmin@porteria.local` | Community admin de Torre Norte | Alcance limitado a su comunidad |
| `operador@porteria.local` | Operator | Panel de operación |
| `guardia@porteria.local` | Guard | Panel de guardia |
| `residente@porteria.local` | Owner de A-101 | Debe caer en `/app-required` |
| `multi@porteria.local` | Owner Torre Norte + resident Los Álamos | Selección y cambio de contexto |

## 1. Platform admin

Login: `superadmin@porteria.local`.

### 1.1 Navegación

- [ ] `/platform` carga el resumen.
- [ ] `/platform/organizations` muestra organizaciones.
- [ ] `/platform/communities` muestra comunidades.
- [ ] `/platform/sections` carga secciones.
- [ ] `/platform/units` carga unidades.
- [ ] `/platform/invitations` carga invitaciones.
- [ ] `/platform/users` carga usuarios.
- [ ] `/platform/bitacora` carga eventos.
- [ ] `/platform/reports` y `/platform/history` cargan sin errores de consola.
- [ ] El sidebar muestra solo el grupo de plataforma.
- [ ] El menú de usuario abre.
- [ ] El contexto activo dice `platform`.
- [ ] El tema claro/oscuro cambia sin romper el layout.
- [ ] Logout vuelve a `/login`.

### 1.2 Organizaciones y comunidades

- [ ] Crear una organización de prueba.
- [ ] Crear una comunidad de prueba.
- [ ] Verificar que aparecen en tablas y filtros.
- [ ] No borrar datos del seed.

### 1.3 Secciones

Ruta: `/platform/sections`.

- [ ] Columnas visibles: Nombre, Tipo, Comunidad, Niveles, Unidades, Código, Estado, Acciones.
- [ ] El filtro por comunidad cambia la tabla.
- [ ] El filtro por tipo cambia la tabla.
- [ ] La búsqueda por nombre/código funciona.
- [ ] La columna Unidades coincide con el árbol de estructura.
- [ ] `Ver estructura` abre el diálogo correcto.

### 1.4 Árbol de estructura

- [ ] Se listan las estructuras de la comunidad.
- [ ] `Editar estructura` abre el formulario.
- [ ] Cambiar nombre de estructura persiste.
- [ ] Cambiar nombres de niveles persiste.
- [ ] Reducir niveles con nodos existentes se bloquea con error visible.
- [ ] Crear una estructura de **2 niveles** con `Torre` y `Apartamento`.
- [ ] Aparece el botón `Nueva Torre` en la estructura.
- [ ] Se puede crear una Torre.
- [ ] Dentro de la Torre aparece el botón `Apartamento`, no `Piso`.
- [ ] Se puede crear un Apartamento con código `4-403`.
- [ ] El árbol muestra Torre → Apartamentos.
- [ ] La tabla de Secciones muestra la cantidad correcta de Apartamentos.
- [ ] Crear una estructura de **3 niveles** con `Interior`, `Piso`, `Apartamento`.
- [ ] Aparece `Nuevo Interior`, luego `Nuevo Piso` y luego `Nuevo Apartamento`.
- [ ] `Nuevo piso` solo aparece en estructuras de 3 niveles.
- [ ] `Renombrar` funciona en piso y unidad.
- [ ] `Mover unidad` permite elegir piso destino.
- [ ] Mover una unidad con residente conserva la asociación.
- [ ] `Archivar` un piso archiva sus descendientes.
- [ ] `Restaurar` reactiva el subárbol.
- [ ] Intentar eliminar un piso con hijos falla.
- [ ] Intentar eliminar una unidad con residentes falla.
- [ ] Eliminar una unidad vacía funciona.
- [ ] Asociar residente a una unidad funciona.
- [ ] El residente aparece en el panel derecho.
- [ ] Los estados Archivado/Activo se ven claramente.

### 1.5 Auditoría

Después de crear, mover, archivar, restaurar, eliminar y asociar residente:

- [ ] Ir a `/platform/bitacora`.
- [ ] Aparecen eventos de estructura.
- [ ] Aparecen eventos de sección.
- [ ] Aparecen eventos de nodo.
- [ ] Aparecen eventos de residente.
- [ ] Cada evento muestra actor, fecha y metadata útil.

Eventos esperados:

```text
location_structure.created
location_structure.updated
location_section.created
location_section.updated
location_section.deleted
location_node.created
location_node.updated
location_node.deleted
location_node.archived
location_node.restored
location_resident.associated
```

### 1.6 Invitaciones

- [x] Crear una invitación.
- [x] Copiar el link.
- [x] Abrir el link en ventana privada.
- [x] El formulario de aceptación carga.
- [x] No aceptar invitaciones reales si no se quieren crear usuarios extra.

## 2. Org admin

Login: `admin@porteria.local`.

Ruta esperada: `/admin`.

### 2.1 Dashboard

- [x] Cards de resumen con datos.
- [x] Sidebar de administración.
- [x] Menú de usuario.
- [x] Tema claro/oscuro.
- [x] Logout.

### 2.2 Secciones

Ruta: `/admin/sections`.

- [ ] Filtro por comunidad.
- [ ] Filtro por tipo.
- [ ] Búsqueda.
- [ ] Columna Unidades.
- [ ] Botón `Nueva estructura`.
- [ ] `Ver estructura`.
- [ ] Archivar/restaurar.
- [ ] Errores de validación visibles.

### 2.3 Unidades

Ruta: `/admin/units`.

- [ ] Filtro por comunidad.
- [ ] Filtro por sección.
- [ ] Búsqueda por código.
- [ ] Solo aparecen unidades dentro del alcance.
- [ ] No aparecen datos de otra organización.

### 2.4 Invitaciones, usuarios y llamadas

- [ ] `/admin/invitations`: crear/revocar.
- [ ] `/admin/users`: listado y conteo.
- [ ] `/admin/calls`: historial o empty state.

### 2.5 Análisis

- [ ] `/analysis/bitacora` carga eventos.
- [ ] `/analysis/reports` carga reportes del tenant.
- [ ] El chart no muestra datos globales de plataforma.

## 3. Community admin y aislamiento

Login: `communityadmin@porteria.local`.

- [ ] Solo ve Torre Norte.
- [ ] No ve Condominio Los Álamos.
- [ ] No puede crear estructuras en otra comunidad.
- [ ] Una URL de otra comunidad no le da acceso.
- [ ] En `/admin/units` solo ve unidades de Torre Norte.

Repetir con `admin2@porteria.local`.

- [ ] Ve solo la organización independiente.
- [ ] No ve Torre Norte.
- [ ] Los conteos cambian respecto de `admin@`.

## 4. Operador y guardia

### Operador

Login: `operador@porteria.local`.

- [ ] Home cae en panel de operador.
- [ ] Sidebar muestra Operación y Análisis.
- [ ] No aparece administración.
- [ ] No puede entrar a `/admin` ni `/platform`.

### Guardia

Login: `guardia@porteria.local`.

- [x] Home cae en `/guard`.
- [x] El panel de guardia carga.
- [x] No puede administrar estructura.
- [x] Puede ver bitácora/reportes según su rol.

## 5. Multi-contexto

Login: `multi@porteria.local`.

- [x] Aparece `Elegí tu contexto`.
- [x] Se listan las dos membresías.
- [ ] Elegir Torre Norte entra al dashboard tenant.
- [ ] El menú de usuario permite cambiar a Los Álamos.
- [ ] Cambian datos, sidebar y permisos.
- [ ] Recargar restaura el contexto.
- [ ] Logout funciona.

## 6. Residentes y `/app-required`

Login: `residente@porteria.local`.

- [ ] Redirige a `/app-required`.
- [ ] Se muestra el aviso de Zima QR Access.
- [ ] Se muestra el email de la sesión activa.
- [ ] Existe el botón `Cerrar sesión y usar otra cuenta`.
- [ ] Al hacer clic vuelve a `/login`.
- [ ] Recargar `/app-required` después del logout redirige a `/login`.
- [ ] El botón Atrás no vuelve a `/app-required`.
- [ ] Desde `/login` se puede entrar como otro usuario.

Esto es correcto: la app móvil todavía no existe.

## 7. Entrada por comunidad

Abrir:

```text
http://localhost:5174/c/torre-norte
```

- [x] Muestra organización, comunidad y dirección.
- [x] El login funciona.
- [x] Slug inválido (`/c/no-existe`) muestra `Comunidad no encontrada`.
- [x] API caída muestra `No se pudo conectar` y botón reintentar.

## 8. Responsive / QA mobile del dashboard

Viewports:

- [x] 390 x 844 (iPhone).
- [x] 360 x 800 (Android chico).

Revisar:

- [x] `/admin/sections` no rompe layout.
- [x] `/platform/sections` no rompe layout.
- [x] Los filtros se apilan.
- [ ] La tabla tiene scroll horizontal si hace falta.
- [ ] El diálogo de estructura no se sale de pantalla.
- [ ] Las acciones de sección/piso/unidad hacen wrap.
- [ ] Los botones son táctiles y no se cortan.
- [ ] El panel de residentes queda debajo del árbol.
- [ ] Archivar/restaurar/eliminar son accesibles.
- [ ] El menú de usuario funciona.
- [ ] El login se ve bien.
- [ ] El tema oscuro se ve bien.

## 9. Evidencia

Registrar por caso:

| Campo | Valor |
|---|---|
| Caso | Login + ruta + acción |
| Esperado | Resultado esperado |
| Obtenido | OK / falla |
| Evidencia | Screenshot |
| Consola | Errores JS |
| Network | 401/403/500 inesperados |

Casos críticos mínimos:

1. Platform sections + Unidades.
2. Crear piso/unidad.
3. Mover unidad con residente.
4. Archivar/restaurar subárbol.
5. Bloqueo de borrado con hijos/residentes.
6. Auditoría en bitácora.
7. Aislamiento `admin2` vs Torre Norte.
8. Multi-contexto.
9. Residente → `/app-required` → logout → `/login`.
10. Responsive del árbol.

## 10. App móvil: estado y dependencia

No existe app móvil implementada.

Evidencia:

- `apps/resident` es un stub PWA.
- No existe `apps/zima-qr-access`.
- `/app-required` avisa que la app está para Android/iOS.
- `add-zima-qr-access-app`: 0/64.

Sí existe spec:

```text
openspec/changes/add-zima-qr-access-app/
```

Dependencias:

- `add-dynamic-qr-access` (0/94).
- `add-notification-service` (0/65).
- `align-qr-access-with-locations` (0/35).
- `separate-people-and-accounts` (0/36).
- `extend-admin-hierarchy` (0/37).
- `add-delegated-subusers` (0/36).

Orden recomendado:

1. Terminar `add-configurable-location-hierarchy`.
2. `separate-people-and-accounts`.
3. `extend-admin-hierarchy`.
4. `add-delegated-subusers`.
5. `align-qr-access-with-locations`.
6. `add-dynamic-qr-access`.
7. `add-notification-service`.
8. `add-zima-qr-access-app`.

No conviene crear la app Expo antes de que QR dinámico y notificaciones tengan contrato estable.
