## Context

El proyecto ya tiene infraestructura MQTT (Mosquitto en Docker), un scaffold `mqtt-bridge` (Fastify, puerto 3002), y el patrón Signaling → API internal establecido por `add-call-persistence` vía `persist.ts`. Los `access_points` tienen columna `gpio_pin` pero ningún sistema la usa para control físico.

Este diseño sigue los mismos patrones de código que el resto del proyecto:
- **Drizzle ORM** para schema en `packages/database/src/schema/`
- **Zod** para validación en `server/api/src/schemas/`
- **DTOs** en `packages/shared/src/dto/`
- **Services** en `server/api/src/services/` con `createDb()` del package `@porteria/database`
- **Routes** como plugins Fastify autenticados (JWT) e internos (API key)
- **Fire-and-forget** HTTP calls desde signaling con `.catch()` logging (patrón `persist.ts`)

## Goals / Non-Goals

**Goals:**
- 4 relés por RPi4, cada uno con GPIO pin, modo (momentary/latch), duración configurable
- Activar relé desde el dashboard (botón "Abrir puerta" + 3 botones extra)
- Feedback de estado en tiempo real en la UI (necesario para latch)
- Persistencia de configuración en PostgreSQL
- Seguir los patrones de código existentes (Zod, DTOs, services, internal endpoints)

**Non-Goals:**
- No modifica el kiosk React app (la UI del RPi solo muestra DoorFlash, no controla GPIO)
- No agrega autenticación al mqtt-bridge (está en red interna, misma security boundary que Mosquitto)
- No soporta múltiples RPis con diferentes configs en este change (aunque el schema lo permite vía `kiosk_id` FK)
- No migra datos existentes (tabla nueva, seed nuevo)

## Decisions

### 1. Signaling → API internal → mqtt-bridge (tres saltos)

```
Signaling ──fetch()──▶ API internal ──fetch()──▶ MQTT Bridge ──publish──▶ Mosquitto
```

**Razonamiento**: Sigue el patrón establecido por `persist.ts`. La API es dueña de los datos (lee `relay_outputs` de DB). El mqtt-bridge solo habla MQTT y Socket.io — es un gateway, no un servicio de negocio. El signaling no conoce MQTT ni la DB de relays.

**Alternativa considerada**: Signaling → mqtt-bridge directo. Descartada porque requeriría que el signaling o el mqtt-bridge lean la DB de relays, rompiendo la separación de responsabilidades y el patrón existente.

### 2. Tabla relay_outputs en vez de extender access_points

`access_points` representa puntos de acceso físico (puertas, portones, torniquetes). `relay_outputs` representa salidas GPIO concretas. Un access point puede tener un relay asociado (para el botón "Abrir puerta"), pero también hay relays sin access point (botones extra).

```sql
relay_outputs:
  kiosk_id FK → kiosks        -- qué RPi4 controla este relé
  relay_index 1-4             -- índice único por kiosk
  gpio_pin                    -- pin BCM
  mode: momentary | latch
  duration_ms                 -- solo para momentary
  access_point_id FK nullable -- link al botón "Abrir puerta"
```

**Razonamiento**: Separación clara entre "qué se abre" (access_point) y "cómo se activa" (relay_output). Permite relays sin access point para usos generales (luces, alarmas).

### 3. Modo latch: botón único con toggle

Latch = presionar para ON, presionar de nuevo para OFF. El estado se trackea en el RPi (el daemon conoce el estado actual del GPIO) y se publica vía MQTT status. El dashboard solo muestra el estado y emite `relay:trigger`.

**Alternativa considerada**: Dos botones (ON/OFF separados). Descartada: el usuario pidió explícitamente toggle con un solo botón.

### 4. MQTT Bridge: REST + Socket.io, sin DB

El mqtt-bridge NO accede a PostgreSQL. Recibe comandos vía REST del API server y los publica en MQTT. Recibe status del RPi vía MQTT y los forwardea al dashboard vía Socket.io. Es un relay puro (valga la redundancia).

**Razonamiento**: Minimiza dependencias. El bridge solo necesita `mqtt.js` y `socket.io`. Si en el futuro necesita acceder a la DB, se puede agregar el package `@porteria/database`.

### 5. Socket.io en mqtt-bridge para status push

El dashboard se conecta al Socket.io del mqtt-bridge (no al del signaling server) para recibir `relay:status`. Esto mantiene separadas las responsabilidades: signaling maneja llamadas, mqtt-bridge maneja relays.

```
Dashboard ──socket.io──▶ mqtt-bridge:3002
  se suscribe a: relay:status { buildingId, relayIndex, state }
```

### 6. MQTT topic structure

```
Comandos: porteria/{buildingId}/relay/{index}/set
  → { state: "ON"|"OFF"|"TOGGLE", durationMs?: number, requestId: string }

Status:   porteria/{buildingId}/relay/{index}/status
  → { state: "ON"|"OFF", timestamp: number }
```

El `buildingId` es el `rpi_id` del kiosk (ej: `rpi-demo-001`), que es como el signaling server identifica al kiosk. Esto permite que el daemon en el RPi sepa qué mensajes son para él.

## Architecture Flow

```
Operador click "Abrir Puerta"           Operador click botón extra
        │                                      │
        ▼                                      ▼
  socket.emit('door:open')              socket.emit('relay:trigger',
        │                                 { buildingId, relayIndex })
        ▼                                      │
  Signaling: operator.ts                       ▼
  ├─ door:open handler                   Signaling: operator.ts
  │   ├─ emit al kiosk (UI)              ├─ relay:trigger handler
  │   └─ fetch POST                      │   └─ fetch POST
  │       /api/internal/relays/trigger   │       /api/internal/relays/trigger
  │                                      │
        └────────────┬───────────────────┘
                     ▼
              API: relays.routes.ts (internal)
              ├─ valida con Zod
              ├─ relays.service.getRelayForAccessPoint()
              │   o relays.service.getRelayByIndex()
              │   → lee relay_outputs de DB
              │   → determina gpio_pin, mode, duration_ms
              └─ fetch POST mqtt-bridge:3002/relays/trigger
                     │
                     ▼
              MQTT Bridge: POST /relays/trigger
              ├─ valida body
              ├─ mqttClient.publish(
              │   `porteria/{buildingId}/relay/{index}/set`,
              │   { state, durationMs, requestId })
              └─ responde { ok: true, requestId }
                     │
                     ▼
              Mosquitto (Docker)
                     │
                     ▼
              RPi4: relay-daemon.py
              ├─ recibe mensaje MQTT
              ├─ GPIO.on()/off()/toggle()
              ├─ si momentary: programa timer para off
              └─ publica status:
                  `porteria/{buildingId}/relay/{index}/status`
                     │
                     ▼
              Mosquitto → MQTT Bridge (sub)
              └─ io.to('operators').emit('relay:status', {...})
                     │
                     ▼
              Dashboard: socket.on('relay:status')
              └─ actualiza estado visual de botones
```

## Risks / Trade-offs

- **[3 saltos de red]**: Signaling → API → MQTT Bridge → Mosquitto agrega ~10-20ms de latencia por hop HTTP. Para control de relés esto es insignificante (el relé físico tarda ~5-10ms en activarse). → Aceptable.
- **[Bridge sin auth]**: El mqtt-bridge acepta requests sin autenticación. → El API server es el único que lo llama (red interna Docker). En producción se puede agregar API key si se expone.
- **[Estado latch en memoria del RPi]**: Si el daemon se reinicia, pierde el estado del relé (no sabe si estaba ON u OFF). → Al iniciar, el daemon lee el estado físico del GPIO (`gpiozero` permite leer `value`) y publica el estado actual.
- **[Single point of failure]**: Si Mosquitto o el mqtt-bridge están caídos, los relés no funcionan. → El sistema sigue funcionando para videollamadas (door:open sigue emitiendo al kiosk para UI). Degradación grácil, no catastrófica.
