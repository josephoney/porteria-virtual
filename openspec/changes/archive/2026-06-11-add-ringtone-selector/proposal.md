## Why

El ringtone actual es un único tono hardcodeado (doble seno 800+1000Hz). En entornos con múltiples operadores en la misma sala, un solo sonido genera confusión — no se sabe de quién es la llamada. Además, distintos operadores tienen distintas preferencias auditivas (tono más suave, más agudo, patrón más rápido). Darles 8-10 opciones para elegir y previsualizar resuelve ambos problemas.

## What Changes

- **Ringtone definitions**: Nuevo módulo `ringtones.ts` con 8-10 ringtones definidos como parámetros Web Audio API (voces, timbres, patrones rítmicos)
- **Ringtone selector UI**: Dropdown o lista de opciones en el OperatorPanel, al lado del toggle "Modo superpuesto". Cada opción muestra nombre y permite previsualización al hacer hover/click
- **Ringtone persistence**: El ID del ringtone seleccionado se guarda en `localStorage` (mismo patrón que `callDisplayMode`)
- **Ringtone playback**: `SocketContext.startRing()` usa el ringtone seleccionado en vez del tono hardcodeado
- **Ringtone preview**: Click en una opción reproduce el ringtone una vez (sin loop) para que el operador lo escuche antes de elegir

## Capabilities

### New Capabilities
- `ringtone-definitions`: Sistema de definición de ringtones con Web Audio API — estructura de datos para voces, timbres, y patrones rítmicos. Incluye el engine de playback parametrizado que reemplaza el `startRing()` hardcodeado actual.

### Modified Capabilities
- `operator-call-ui`: El requirement "Incoming call ring sound" cambia de "un solo tono hardcodeado" a "ringtone seleccionable por el operador". Se agrega el escenario de preview.
- `dashboard-operator`: OperatorPanel incluye el nuevo componente RingtoneSelector en el header del panel principal.

## Impact

- `apps/dashboard/src/lib/ringtones.ts`: Nuevo — definiciones de 8-10 ringtones (~100 líneas)
- `apps/dashboard/src/contexts/SocketContext.tsx`: `startRing()` parametrizado por ringtone ID (~30 líneas cambiadas)
- `apps/dashboard/src/components/operator/RingtoneSelector.tsx`: Nuevo — componente picker (~40 líneas)
- `apps/dashboard/src/components/operator/OperatorPanel.tsx`: Integración del selector en el header (~5 líneas)
- `apps/dashboard/src/App.css`: Estilos del selector (~20 líneas)
