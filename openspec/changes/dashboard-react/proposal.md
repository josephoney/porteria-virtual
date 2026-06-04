## Why

El panel de operador actual vive en `legacy/operator.html` como un archivo vanilla JS de 730 líneas. La app `apps/dashboard/` es un scaffold React vacío con React Router. Este change lo migra a una SPA completa que unifica los 3 roles (operador, admin, guard) bajo un mismo shell con navegación basada en rol, conectándose al servidor de señalización para llamadas WebRTC y a la API REST para gestión de usuarios.

## What Changes

- Reemplazar `apps/dashboard/src/App.tsx` con un shell de dashboard: TopBar + Sidebar + Router outlet
- Implementar panel de operador: llamadas en vivo con WebRTC, cola de llamadas entrantes, lista de kiosks, apertura de puerta, log de eventos
- Implementar panel de admin: gestión de usuarios (lista, crear, editar) consumiendo la API `server/api/`
- Implementar panel de guard: placeholder con rondas (Fase 4)
- Socket.io context compartido para conexión al signaling server
- WebRTC hook para manejo de videollamadas (similar al kiosk pero como receptor)
- React Router con guards por rol: admin ve admin pages, operator ve operator panel
- Diseño visual idéntico al legacy: tema claro (#f5f4ef), tipografía Syne + IBM Plex Mono

## Capabilities

### New Capabilities
- `dashboard-shell`: Layout del dashboard con TopBar, Sidebar navegable por rol, React Router con rutas anidadas, y conexión al signaling server vía Socket.io.
- `dashboard-operator`: Panel del operador — videollamada WebRTC entrante, cola de llamadas con toast de notificación, lista de kiosks con estados, control de puerta, y registro de eventos en tiempo real.
- `dashboard-admin`: Gestión de usuarios — lista paginada, crear nuevo usuario, editar rol/estado, todo consumiendo `server/api/`. Accesible solo con rol admin.

### Modified Capabilities
<!-- Ninguno -->

## Impact

- **App**: `apps/dashboard/` pasa de scaffold vacío a SPA funcional multi-rol
- **Dependencias**: `socket.io-client` y `react-router-dom` (ya en package.json), no nuevas
- **API**: Consume `server/api/` para auth y users CRUD
- **Signaling**: Se conecta a `legacy/server.js` (mismos eventos Socket.io: `operator:register`, `call:incoming`, `door:open`, etc.)
- **Legacy**: `legacy/operator.html` sigue funcionando — no se elimina hasta verificar paridad
