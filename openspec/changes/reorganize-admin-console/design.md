## Context

La consola actual concentra seis tabs en `PlatformPage` y cuatro en `AdminPanel`. El
sidebar solo tiene Operador/Admin/Guardia/Plataforma. La tabla de “Torres” usa
`buildings`, pero el modelo objetivo es la jerarquía configurable de
`add-configurable-location-hierarchy`, donde una sección es el nodo raíz de nivel 1.

## Goals / Non-Goals

**Goals:**

- Navegación lateral por rutas, con deep links y estado activo.
- Una matriz clara de visibilidad por rol y alcance.
- Páginas de listado consistentes con tablas y estados.
- “Secciones” como reemplazo de “Torres”, sin duplicar el modelo de ubicaciones.
- Mantener Historial/Bitácora/Reportes accesibles.

**Non-Goals:**

- No se implementa el modelo de secciones ni el catálogo de tipos.
- No se cambia el backend de auth/RBAC.
- No se implementa el sistema de temas.
- No se rediseña el panel de operador.

## Decisions

### 1. Sidebar como fuente de navegación

**Decisión:** cada ítem del sidebar es una ruta real; no hay tabs de nivel superior. Los
tabs se permiten dentro de una página solo para sub-vistas relacionadas.

**Alternativas:** mantener tabs y sincronizar con query params. Se descarta: no hay deep
links limpios ni estado activo confiable.

### 2. Grupos del sidebar

**Decisión:** el sidebar se agrupa así:

- **Operación:** Operador, Guardia.
- **Administración:** Organizaciones, Comunidades, Secciones, Unidades, Invitaciones,
  Usuarios.
- **Análisis:** Bitácora, Reportes y, solo para superadmin, Historial.

En contexto plataforma se muestran **Administración** completa y **Análisis** con
Bitácora, Reportes e Historial; no se muestran Operación. En contexto tenant,
guardias/operadores ven Operación y Análisis (Bitácora, Reportes). Los admins tenant ven
Operación, Administración y Análisis (Bitácora, Reportes).

### 3. Matriz de visibilidad

| Ítem | Plataforma | Org admin | Community admin |
| --- | --- | --- | --- |
| Organizaciones | Sí | No | No |
| Comunidades | Sí | Sí (su org) | No |
| Secciones | Sí | Sí (su org) | Sí (su comunidad) |
| Unidades | Sí | Sí (su org) | Sí (su comunidad) |
| Invitaciones | Sí | Sí (su org) | Sí (su comunidad) |
| Usuarios | Sí (global) | Sí (su org) | Sí (su comunidad) |
| Bitácora | Sí (global) | Sí (su org) | Sí (su comunidad) |
| Reportes | Sí (global) | Sí (su org) | Sí (su comunidad) |
| Historial | Sí (global) | No | No |
| Operador/Guardia | No | Sí | Sí |

La UI oculta lo no permitido, pero el backend sigue validando y devolviendo 403/404.

### 4. Rutas

| Contexto | Rutas |
| --- | --- |
| Plataforma | `/platform` (Resumen), `/platform/organizations`, `/platform/communities`, `/platform/sections`, `/platform/units`, `/platform/invitations`, `/platform/users`, `/platform/bitacora`, `/platform/reports`, `/platform/history` |
| Org admin | `/admin` (Resumen), `/admin/communities`, `/admin/sections`, `/admin/units`, `/admin/invitations`, `/admin/users`, `/analysis/bitacora`, `/analysis/reports` |
| Community admin | `/admin` (Resumen), `/admin/sections`, `/admin/units`, `/admin/invitations`, `/admin/users`, `/analysis/bitacora`, `/analysis/reports` |
| Guard/operator | `/analysis/bitacora`, `/analysis/reports` |

Redirecciones:
- `/platform` → dashboard Resumen.
- `/admin` → Resumen del alcance del usuario (organización o comunidad).
- Un ítem no permitido redirige al primer ítem permitido; nunca renderiza una página
  vacía.

### 5. Página de listado

**Decisión:** un patrón único:

1. Header con título, descripción y acción primaria.
2. Barra de búsqueda/filtros.
3. Tabla central con columnas, paginación y acciones por fila.
4. `loading` con skeleton, `empty` con mensaje claro y `error` con reintento.
5. Formularios de creación/edición en `Dialog` o `Sheet`.
6. En mobile, tabla con scroll horizontal o cards.

### 6. Secciones

**Decisión:** la página consume el listado paginado de secciones de
`add-configurable-location-hierarchy`. Columnas: nombre, tipo, comunidad, niveles,
unidades y estado. Filtros: comunidad, tipo y búsqueda. Crear/editar incluye
`sectionType` y, si es `other`, `sectionTypeLabel`.

No se crea una tabla `sections` nueva en este change.

### 7. Unidades

**Decisión:** la página lista hojas de la jerarquía. Columnas: código, sección,
comunidad, tipo, piso y estado. Filtros: comunidad, sección y estado. La creación exige
sección/estructura compatible.

### 8. Invitaciones y Usuarios

**Decisión:** reutilizan los endpoints actuales con alcance por rol. Plataforma ve datos
globales; org_admin su organización; community_admin su comunidad. La tabla incluye
organización/comunidad cuando el alcance lo permite.

### 9. Análisis

**Decisión:** el grupo “Análisis” contiene Bitácora y Reportes para guardias, operadores y
admins tenant; el superadmin además ve Historial. No se eliminan ni se esconden detrás de
“Admin”. El historial de llamadas existente queda accesible como detalle dentro de
Reportes, no como ítem principal del sidebar.

### 10. Bitácora vs Historial

**Decisión:**

- **Bitácora** es la vista legible por ingreso/portería. Muestra fecha, hora, resultado
  (autorizado/denegado/código no funciona), persona que ingresa, vehículo, guarda,
  autorizador y destino (sección/unidad).
- **Historial** es la vista técnica para diagnóstico. Incluye todo lo de la bitácora más
  organización, comunidad, event id, actor, metadata y trazabilidad del código (cuándo se
  generó, quién lo generó, cuándo se usó y errores).
- **Reportes** agrega métricas por período y alcance.
- La bitácora se alimenta de eventos de acceso; el historial expone el evento técnico
  subyacente. No se duplica la fuente de verdad.

### 11. Responsive y accesibilidad

**Decisión:** sidebar colapsa en Sheet en mobile; el ítem activo se marca por ruta; los
icon buttons llevan `aria-label`; las tablas tienen scroll horizontal.

## Risks / Trade-offs

- **[Riesgo] Duplicar requisitos con `extend-admin-hierarchy`** → Mitigación: la matriz
  de permisos vive allí; este change define navegación y páginas, no una segunda matriz.
- **[Riesgo] Romper deep links existentes** → Mitigación: redirecciones desde
  `/admin` y `/analysis`.
- **[Riesgo] Secciones sin el modelo nuevo** → Mitigación: depende de
  `add-configurable-location-hierarchy`; no se implementa con `buildings` como modelo
  final.
- **[Trade-off] Más rutas y páginas** → Más archivos, pero mejor navegación y testeo.

## Open Questions

- ¿“Análisis” debe existir también para plataforma? Propuesta: no; plataforma solo
  estructura.
- ¿Invitaciones de plataforma y de tenant comparten página? Propuesta: misma página con
  alcance y columnas distintas.
