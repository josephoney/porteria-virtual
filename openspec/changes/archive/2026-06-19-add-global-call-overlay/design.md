## Context

Actualmente, el manejo de llamadas entrantes (toast, ringtone, WebRTC, video) está acoplado a `OperatorPanel`, que se desmonta al navegar a `/admin` o `/guard`. Esto impide recibir y atender llamadas desde cualquier menú que no sea el panel del operador.

El `SocketContext` ya mantiene el estado global de llamadas (`pendingCalls`, `activeCall`, `setActiveCall`, `removePendingCall`, `stopRing`). El hook `useWebRTC` es independiente y reutilizable.

## Goals / Non-Goals

**Goals:**
- Mostrar toast de llamada entrante en cualquier ruta del dashboard
- Reproducir ringtone en cualquier ruta
- Permitir aceptar, colgar y abrir puerta desde cualquier ruta vía overlay
- Mantener el modo inline en el panel del operador como experiencia default
- Reutilizar `SocketContext`, `useWebRTC` y `VideoPanel` sin cambios

**Non-Goals:**
- Cambiar el backend, signaling o API
- Modificar la mecánica de WebRTC o Socket.io
- Hacer el PiP arrastrable (MVP: posición fija)
- Múltiples llamadas simultáneas en PiP

## Decisions

### 1. IncomingCallOverlay como componente en DashboardLayout

**Decisión**: Crear `IncomingCallOverlay.tsx` en `components/layout/` y renderizarlo en `DashboardLayout.tsx` antes del `<Outlet />`.

```
DashboardLayout
├── IncomingCallOverlay  ← position: fixed, z-index: 9999
├── TopBar
├── Sidebar
└── Outlet
```

**Alternativa considerada**: Portal a `document.body`. Se descartó porque el overlay necesita acceso a `SocketContext` que ya envuelve `DashboardLayout`.

### 2. Compartir estado de llamada vía SocketContext

**Decisión**: El overlay lee `pendingCalls`, `activeCall`, `setActiveCall`, `removePendingCall`, `stopRing` del contexto. El `OperatorPanel` también los lee para su vista inline.

**Flujo**:
```
call:incoming → SocketContext (pendingCalls Map)
                  ├─ IncomingCallOverlay: muestra toast + ringtone
                  └─ OperatorPanel: muestra item en CallQueue (si está montado)

Aceptar → IncomingCallOverlay: handleAcceptCall()
            ├─ SocketContext: setActiveCall(), removePendingCall(), stopRing()
            ├─ useWebRTC: getLocalStream(), peer connection
            └─ Socket.io: emit 'call:accept'

Colgar → IncomingCallOverlay: handleEndCall()
           ├─ SocketContext: setActiveCall(null)
           ├─ useWebRTC: cleanupPeer()
           └─ Socket.io: emit 'call:end'
```

### 3. Modo inline solo en OperatorPanel

**Decisión**: El `VideoPanel` inline se mantiene en `OperatorPanel`. Cuando el operador está en otra ruta, el overlay muestra el PiP. Al volver al panel operador, el PiP se oculta y el video inline se muestra.

**Estado de display**:
- `activeCall && route === '/' && callDisplayMode === 'inline'` → VideoPanel inline en OperatorPanel
- `activeCall && (route !== '/' || callDisplayMode === 'overlay')` → PiP en IncomingCallOverlay

## Risks / Trade-offs

- **[Riesgo] Duplicación de lógica accept/end entre overlay y OperatorPanel** → Mitigación: El overlay es la fuente de verdad para el ciclo de vida de la llamada. OperatorPanel solo muestra vistas.
- **[Trade-off] RingtoneSelector ubicación** → Se mueve de OperatorPanel a TopBar para ser accesible desde cualquier ruta
- **[Trade-off] Relay controls en admin/guard** → Los botones de relay se mantienen en OperatorPanel. Desde el PiP solo están disponibles colgar, abrir puerta y mute.
