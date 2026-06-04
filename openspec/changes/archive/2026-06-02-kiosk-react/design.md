## Context

`apps/kiosk/` es un scaffold React + Vite vacío. `legacy/kiosk.html` tiene la UI funcional con WebRTC + Socket.io. El objetivo es migrar a React manteniendo la misma funcionalidad y apariencia. El signaling server (`legacy/server.js`) no se modifica.

## Goals / Non-Goals

**Goals:**
- Portar las 3 pantallas del kiosk a componentes React (IdleScreen, CallingScreen, InCallScreen)
- Implementar WebRTC con hooks React (`useWebRTC`, `useLocalStream`)
- Implementar conexión Socket.io con React Context
- Mantener el diseño visual exacto: dark theme (#0a0c0f), grid background, noise grain, animaciones CSS
- Funcionar contra el signaling server legacy y contra el futuro `server/signaling`
- PWA ready: manifest + service worker básico para cacheo offline
- Responsive para display 7" (800x480 típico de RPi touch) y adaptable a cualquier viewport

**Non-Goals:**
- No se implementa face recognition (fase 5)
- No se integra auth JWT en el kiosk (el kiosk se registra por buildingId, no por usuario)
- No se migra el signaling server (change futuro)
- No se modifica `legacy/kiosk.html`

## Decisions

### 1. Componentes funcionales con hooks

**Decisión**: Componentes funcionales React con hooks (`useState`, `useEffect`, `useRef`, `useCallback`). Sin clases.

**Razonamiento**: Estándar React moderno. Los hooks como `useRef` son ideales para mantener referencias a `RTCPeerConnection` y `MediaStream` sin triggers de re-render.

### 2. Socket.io via React Context

**Decisión**: Provider `SocketProvider` que crea la conexión y la expone vía contexto.

```typescript
// SocketContext proporciona:
// - socket: Socket (conectado al signaling server)
// - isConnected: boolean
// - buildingId: string
// - buildingName: string
```

**Razonamiento**: Evita prop drilling. Cualquier componente puede acceder al socket. La conexión se establece una sola vez en el provider.

### 3. WebRTC via hook `useWebRTC`

**Decisión**: Hook personalizado que encapsula todo el ciclo de vida WebRTC.

```typescript
function useWebRTC(socket, currentCallId) {
  // localStream, remoteStream, peerConnection
  // startCall(), endCall(), toggleMute()
  // Maneja: offer, answer, ICE candidates
}
```

**Razonamiento**: La lógica WebRTC es compleja (getUserMedia, RTCPeerConnection, ICE candidates). Encapsularla en un hook permite reusarla (futuro dashboard-react) y testearla aisladamente.

### 4. Pantallas como componentes separados

**Decisión**: Cada estado del kiosk es un componente: `IdleScreen`, `CallingScreen`, `InCallScreen`.

```typescript
function KioskApp() {
  const { screen } = useKioskState(); // 'idle' | 'calling' | 'in-call'
  
  switch (screen) {
    case 'idle': return <IdleScreen />;
    case 'calling': return <CallingScreen />;
    case 'in-call': return <InCallScreen />;
  }
}
```

**Razonamiento**: Cada pantalla tiene su propio layout, estilos, y comportamiento. Separarlas mantiene el código limpio. El estado global (`screen`) vive en el contexto o en un hook `useKioskState`.

### 5. CSS Modules sobre styled-components

**Decisión**: CSS vanilla con variables CSS (mismo approach del legacy) en `src/index.css` global + estilos inline o CSS modules para componentes.

**Razonamiento**: El legacy ya tiene un sistema de diseño con CSS variables bien definido. Mantenerlo es más rápido y familiar. CSS modules agregarían tooling innecesario para una app tan chica.

### 6. PWA: manifest + service worker simple

**Decisión**: `vite-plugin-pwa` para generar manifest y service worker con estrategia cache-first.

**Razonamiento**: El kiosk en RPi debe funcionar aunque el signaling server esté temporalmente offline. Un SW básico cachea los assets (HTML, JS, CSS) para que la app cargue siempre. La WebRTC obviamente requiere conexión.

### 7. Estructura de archivos

```
apps/kiosk/src/
├── main.tsx
├── App.tsx                  # Root: TopBar + screen switch
├── App.css                  # Global styles (dark theme)
├── components/
│   ├── TopBar.tsx            # Header con status dot y reloj
│   ├── IdleScreen.tsx        # Reloj grande + botón llamar
│   ├── CallingScreen.tsx     # Animación conectando + cancelar
│   ├── InCallScreen.tsx      # Video + controles (mute, colgar)
│   └── DoorFlash.tsx         # Overlay "PUERTA ABIERTA"
├── contexts/
│   └── SocketContext.tsx      # Socket.io connection + state
├── hooks/
│   ├── useWebRTC.ts           # WebRTC lifecycle
│   ├── useKioskState.ts       # screen state, call timer
│   └── useClock.ts            # Reloj actualizable
└── config.ts                  # BUILDING_ID, SERVER_URL, ICE_SERVERS
```

## Risks / Trade-offs

- **[Riesgo] WebRTC APIs son inestables en navegadores viejos** → Mitigación: Chromium en RPi es moderno (basado en Chrome). Testear en Chromium 90+.
- **[Riesgo] Cámara puede no estar disponible** → Mitigación: Manejar error `getUserMedia` con mensaje en UI.
- **[Trade-off] Sin type safety en eventos Socket.io** → Los eventos tienen strings mágicos (`call:accepted`, `door:open`). Se podría tipar con `socket.io-client` types, pero agrega complejidad innecesaria para esta fase.
- **[Trade-off] CSS global vs modules** → Se usa CSS global para mantener el sistema de variables del legacy. Si la app crece, migrar a CSS modules.
