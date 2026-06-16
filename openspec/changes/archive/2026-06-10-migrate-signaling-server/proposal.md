## Why

Todo el signaling WebRTC (registro de kiosks/operadores, ciclo de vida de llamadas, relay offer/answer/ICE, control de puerta, timeouts) corre en `legacy/server.js` — 356 líneas de vanilla JS con Express. `server/signaling/` existe como esqueleto Fastify + Socket.io de 34 líneas que solo loguea conexiones.

Esto es un problema porque:

1. **Sin tipos**: Las apps React (kiosk, dashboard) importan de `@porteria/shared` con tipos TypeScript, pero el servidor no tiene idea de esas interfaces. Los eventos Socket.io no están tipados — cualquier cambio de payload rompe en runtime sin que el compilador lo detecte.
2. **Logging pobre**: `console.log` sin estructura, sin niveles, sin contexto de request. En producción es imposible tracear una llamada.
3. **Sin testabilidad**: El archivo monolítico de 356 líneas no se puede testear unitariamente. No hay separación de concerns.
4. **Acoplamiento al legacy**: Las apps React dependen de que `legacy/server.js` esté corriendo. El script `dev:full` del root lo levanta explícitamente. Si se rompe, no hay fallback.
5. **Fricción para nuevas features**: Cualquier feature nueva en el signaling (persistir llamadas en DB, integrar MQTT, métricas) requiere modificar el archivo legacy o duplicar lógica.

## What Changes

- Reemplazar `legacy/server.js` con `server/signaling/` implementado en TypeScript
- Misma semántica de eventos Socket.io (backward compatible con kiosk y dashboard)
- Estado en memoria (paridad con legacy — la persistencia en DB viene después)
- Fastify + pino para structured logging
- Handlers separados por dominio: kiosk, operator, webrtc, call
- Tipos TypeScript para todos los eventos y payloads
- Health check extendido con métricas básicas (kiosks, operators, calls counts)

## Capabilities

### New Capabilities
- `signaling-server`: Servidor de señalización WebRTC con registro de kiosks y operadores, ciclo de vida de llamadas (request → waiting → accepted → ended), relay de offer/answer/ICE candidates, timeout de 30s para llamadas no contestadas, control de puerta, limpieza de estado en desconexión, health check con métricas, y structured logging vía pino.

### Modified Capabilities
- Ninguno — el protocolo de eventos se mantiene idéntico. Las apps React no se modifican.

## Impact

- **`server/signaling/`**: Pasa de 34 líneas esqueleto a implementación completa (~400 líneas TS)
- **`legacy/server.js`**: Se deja de usar como signaling (se mantiene como referencia)
- **`package.json` root**: `dev:full` y `dev:clean` se actualizan para usar el nuevo signaling en vez del legacy
- **Apps React**: Sin cambios — mismo protocolo Socket.io
- **No breaking changes**: 100% backward compatible con kiosk y dashboard
