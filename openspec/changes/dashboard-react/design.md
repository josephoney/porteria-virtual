## Context

`apps/dashboard/` es un scaffold React + Vite + React Router vacío. `legacy/operator.html` tiene el panel de operador funcional. `server/api/` expone endpoints de auth y users CRUD. El objetivo es unificar los 3 roles bajo un mismo shell.

## Goals / Non-Goals

**Goals:**
- Shell de dashboard con TopBar, Sidebar navegable, y Router outlet
- Panel de operador: WebRTC entrante (recibe offer, envía answer), cola de llamadas, kiosks, apertura de puerta
- Panel de admin: lista de usuarios, crear, editar, usando la API REST con JWT
- Login simple (email/password contra API) para obtener token JWT por rol
- Sidebar que muestra/oculta items según rol
- Mismo diseño visual que el legacy (tema claro, tipografía Syne)

**Non-Goals:**
- No se implementa el panel de guard más allá de un placeholder
- No se implementan gráficos/analytics (Fase 3)
- No se modifica el signaling server
- No se implementa refresh token automático en el frontend

## Decisions

### 1. React Router con layout route

**Decisión**: Layout route padre con TopBar + Sidebar + `<Outlet />` para contenido.

```typescript
<Route path="/" element={<DashboardLayout />}>
  <Route index element={<OperatorPanel />} />
  <Route path="admin" element={<RequireRole role="admin"><AdminPanel /></RequireRole>} />
  <Route path="guard" element={<RequireRole role="guard"><GuardPanel /></RequireRole>} />
</Route>
```

**Razonamiento**: El shell (topbar + sidebar) se renderiza una vez. Las rutas hijas solo cambian el contenido principal.

### 2. Auth via API REST

**Decisión**: Login contra `POST /api/auth/login`, guardar token JWT en estado React (no localStorage por ahora).

```typescript
const { login, user, token } = useAuth();
await login(email, password); // → POST /api/auth/login → guarda token + user en estado
```

**Razonamiento**: El token JWT contiene `{ sub, email, role, orgId }`. El rol determina qué items del sidebar se muestran y qué rutas son accesibles.

### 3. Socket.io para operador (receptor WebRTC)

**Decisión**: El operador se registra en el signaling server como `operator:register` y recibe `call:incoming`. Cuando acepta, recibe el `webrtc:offer` y envía `webrtc:answer`.

**Razonamiento**: Mismo protocolo que el legacy. El dashboard actúa como receptor WebRTC (a diferencia del kiosk que es el iniciador).

### 4. Componentes del operator panel

```
OperatorPanel
├── Sidebar
│   ├── CallQueue        ← llamadas entrantes (pending)
│   ├── ActiveCall       ← llamada activa (si hay)
│   └── KioskList        ← kiosks con status dots
└── MainContent
    ├── VideoPanel       ← video remoto + local PiP
    ├── CallControls     ← abrir puerta, mic, colgar
    └── EventLog         ← log de eventos en tiempo real
```

### 5. Admin panel consume API REST

**Decisión**: El admin panel hace fetch a `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id` con el token JWT en header `Authorization: Bearer <token>`.

### 6. Estructura de archivos

```
apps/dashboard/src/
├── main.tsx
├── App.tsx                    # Router + providers
├── App.css                    # Tema claro global
├── contexts/
│   ├── AuthContext.tsx         # JWT login, user state, token
│   └── SocketContext.tsx       # Socket.io operator connection
├── hooks/
│   ├── useWebRTC.ts            # WebRTC receiver
│   └── useOperatorState.ts    # Calls, kiosks, door, log
├── components/
│   ├── layout/
│   │   ├── DashboardLayout.tsx # TopBar + Sidebar + Outlet
│   │   ├── TopBar.tsx          # Stats, user badge, logout
│   │   └── Sidebar.tsx         # Nav items por rol
│   ├── operator/
│   │   ├── OperatorPanel.tsx   # Panel principal operador
│   │   ├── CallQueue.tsx       # Cola de llamadas
│   │   ├── VideoPanel.tsx      # Video + controles
│   │   ├── KioskList.tsx       # Lista de kiosks
│   │   └── EventLog.tsx        # Registro de eventos
│   ├── admin/
│   │   ├── AdminPanel.tsx      # Panel admin
│   │   └── UsersTable.tsx      # Tabla de usuarios + crear/editar
│   └── guard/
│       └── GuardPanel.tsx      # Placeholder
└── pages/
    └── LoginPage.tsx           # Login form
```

## Risks / Trade-offs

- **[Riesgo] Token en estado React se pierde al recargar** → Se usa localStorage en el futuro. Por ahora, el flujo de operador es continuo (no recarga).
- **[Trade-off] Sin refresh token automático** → Se implementará cuando el token de 15min sea un problema real en uso.
- **[Riesgo] WebRTC receiver comparte lógica con kiosk** → El hook `useWebRTC` del kiosk no es reusable directamente (kiosk crea offer, dashboard responde con answer). Se crea uno específico para receiver.
