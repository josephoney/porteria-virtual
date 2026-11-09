## Why

La consola administrativa hoy vive en tabs dentro de una sola pantalla
(`/platform` y `/admin`). Eso impide deep-linking, mezcla creación con listado, no tiene
una navegación consistente entre plataforma, org_admin y community_admin, y usa “Torres”
para un concepto que debe ser genérico.

## What Changes

- Reorganizar la consola administrativa en **menús laterales y rutas reales**, con el
  contenido central en tablas.
- Menús de estructura:
  - **Organizaciones** (solo plataforma)
  - **Comunidades** (plataforma y org_admin)
  - **Secciones** (plataforma, org_admin y community_admin)
  - **Unidades** (plataforma, org_admin y community_admin)
  - **Invitaciones** (plataforma, org_admin y community_admin)
  - **Usuarios** (plataforma, org_admin y community_admin)
- Mantener y clarificar las vistas de **Bitácora**, **Historial** y **Reportes**:
  - **Bitácora**: registro legible por ingreso/portería, con fecha, hora, resultado,
    persona, vehículo, guarda, autorizador y destino (sección/unidad).
  - **Historial**: registro técnico con organización, comunidad, trazabilidad del código
    y metadata para diagnóstico.
  - **Reportes**: métricas agregadas por período y alcance.
- Visibilidad: Bitácora y Reportes para guardias/operadores y admins de comunidad;
  Historial solo para superadmin. El org_admin ve Bitácora y Reportes de su organización.
- Cada página de estructura tendrá: header, acción primaria, búsqueda/filtros, tabla
  paginada, acciones por fila y estados de loading/empty/error.
- Reemplazar la tab “Torres” por “Secciones” y consumir el modelo de
  `add-configurable-location-hierarchy` (sección = nodo raíz nivel 1, con `sectionType`).
- Definir la matriz de visibilidad por rol/alcance y redirecciones de entrada.
- **Non-goals:** no se implementa el modelo de ubicaciones ni el tipo de sección (van en
  `add-configurable-location-hierarchy`), no se cambia QR/auth, no se implementa el
  sistema de temas.

## Capabilities

### New Capabilities

- `admin-console-navigation`: sidebar, rutas, páginas de listado, tablas, estados,
  matriz de visibilidad y responsive.
- `access-log-views`: Bitácora legible, Historial técnico, Reportes y su visibilidad por
  rol/alcance.

### Modified Capabilities

- `platform-console`: la consola de plataforma deja de ser tabs y pasa a rutas/páginas.
- `dashboard-shell`: el sidebar incorpora los grupos y las rutas administrativas.
- `dashboard-admin`: el panel admin deja de ser tabs y expone páginas propias.

## Impact

- **Dashboard**: `AppSidebar`, `App.tsx`, `PlatformPage`, `AdminPanel`, páginas nuevas
  de organizaciones/comunidades/secciones/unidades/invitaciones/usuarios.
- **API**: consume endpoints existentes y el listado paginado de secciones de
  `add-configurable-location-hierarchy`; no crea un modelo paralelo.
- **Permisos**: reutiliza la matriz de `extend-admin-hierarchy`; la UI oculta y el
  backend sigue siendo la autoridad.
- **Depende de:** `add-configurable-location-hierarchy`, `extend-admin-hierarchy`,
  `standardize-dashboard-ux`.
- **Prioridad:** P1, después de la jerarquía configurable y antes de nuevas pantallas
  administrativas.
