## Context

El dashboard actual tiene un ringtone hardcodeado en `SocketContext.startRing()`: dos osciladores seno (800+1000Hz) que suenan 900ms cada 2200ms. La propuesta `add-ringtone-selector` pide extender esto a un sistema de 8-10 ringtones seleccionables.

**Current architecture:**
```
call:incoming → startRing()
                  ├─ new AudioContext()
                  ├─ create 2 oscillators (sine 800Hz + 1000Hz)
                  ├─ setInterval(playTone, 2200ms)
                  └─ each playTone() creates new oscillators, stops after 900ms
```

**Constraints:**
- Sin dependencias externas (solo Web Audio API nativa)
- Sin assets de audio (ni .mp3 ni .wav)
- Persistencia vía localStorage (mismo patrón que `callDisplayMode`)
- Selector UI al lado del toggle "Modo superpuesto" en OperatorPanel

## Goals / Non-Goals

**Goals:**
- 8-10 ringtones diferenciados usando timbres, frecuencias, y patrones rítmicos distintos
- Selector de ringtone en el OperatorPanel con previsualización audible
- Persistencia de la elección en localStorage
- El ringtone activo se usa en `call:incoming`; se detiene en `call:taken`, `call:ended`, y al aceptar

**Non-Goals:**
- Melodías secuenciadas con notas variables (requeriría un secuenciador, excede el MVP)
- Sincronización de ringtone entre pestañas/navegadores
- Control de volumen por ringtone (el volumen se hereda del sistema)
- Subir ringtones custom (solo los predefinidos)

## Decisions

### 1. Motor de playback: setTimeout chain en vez de setInterval

El `setInterval` actual solo sirve para patrones de un solo pulso repetido. Con patrones rítmicos multi-paso (ej: "beep-beep-beep-pausa"), necesitamos una cadena de `setTimeout` que avance paso a paso por el array `pattern`.

```
Pattern: [ON₁, OFF₁, ON₂, OFF₂, ON₃, OFF₃]

Step 0 (ON₁):  create osc → after ON₁ ms: stop osc, advance to step 1, schedule
Step 1 (OFF₁): do nothing → after OFF₁ ms: advance to step 2, schedule
Step 2 (ON₂):  create osc → after ON₂ ms: stop osc, advance to step 3, schedule
...
After last step (OFF₃): loop back to step 0
```

Cada paso programa el siguiente vía `setTimeout`. Solo hay un timeout pendiente en cada momento → cancelación trivial con `clearTimeout`.

**Alternativa considerada:** `setInterval` con state machine. Descartada porque require mutar estado externo para trackear el paso actual y es más frágil ante cleanup.

### 2. Modelo de datos del ringtone

```typescript
interface RingtoneVoice {
  freq: number;           // Hz
  type: OscillatorType;   // 'sine' | 'square' | 'triangle' | 'sawtooth'
  gain: number;           // 0-1 (amplitud)
}

interface RingtoneDefinition {
  id: string;             // 'classic', 'digital', etc
  name: string;           // 'Clásico', 'Digital'
  description: string;    // Tooltip o subtitle
  voices: RingtoneVoice[];
  pattern: number[];      // [on_ms, off_ms, on_ms, off_ms, ...] — siempre longitud par
}
```

- `voices`: Array de 1-2 osciladores simultáneos. Dos voces permiten acordes (dual-tone). Cada voz tiene su propio tipo de onda y ganancia.
- `pattern`: Array de longitud par. Índices pares = duración ON (osciladores activos), índices impares = duración OFF (silencio). Se recorre en loop.

**Alternativa considerada:** Funciones de playback arbitrarias por ringtone (más flexibles). Descartada porque 10 funciones serían ~300 líneas vs ~80 líneas con modelo de datos. Los 8-10 ringtones propuestos caben perfectamente en el modelo paramétrico.

### 3. Ringtone definitions en módulo separado

Nuevo archivo `apps/dashboard/src/lib/ringtones.ts` que exporta:
- `RINGTONE_DEFINITIONS: RingtoneDefinition[]` — los 8-10 ringtones
- `getRingtoneDefinition(id: string): RingtoneDefinition | undefined` — lookup
- `DEFAULT_RINGTONE_ID = 'classic'` — fallback

El player (`createRingPlayer`) también vive en este módulo, encapsulando toda la lógica de Web Audio.

### 4. Los 10 ringtones

| # | ID | Nombre | Voces | Pattern | Descripción |
|---|-----|--------|-------|---------|-------------|
| 1 | `classic` | Clásico | sine 800 + 1000Hz | `[900, 2200]` | Doble tono telefónico estándar |
| 2 | `digital` | Digital | square 1200Hz | `[150, 80, 150, 80, 150, 1390]` | Triple beep electrónico |
| 3 | `soft` | Suave | sine 600Hz | `[300, 2700]` | Ping sutil, no invasivo |
| 4 | `oldphone` | Teléfono | sine 425Hz | `[1000, 4000]` | Ring largo europeo |
| 5 | `pulse` | Pulso | sawtooth 800Hz | `[100, 100, 100, 100, 100, 100, 100, 1300]` | Pulsos rápidos |
| 6 | `alarm` | Alarma | square 1000 + 1200Hz | `[250, 250, 250, 250, 250, 1750]` | Urgente, alta frecuencia |
| 7 | `buzzer` | Timbre | sawtooth 650 + 850Hz | `[350, 150, 350, 150, 350, 1650]` | Zumbido de portero |
| 8 | `knock` | Golpe | triangle 440Hz | `[80, 80, 80, 280, 80, 80, 80, 1240]` | Knock-knock rítmico |
| 9 | `highbeep` | Agudo | sine 1500Hz | `[200, 150, 200, 2450]` | Beeps cortos agudos |
| 10 | `deep` | Profundo | sine 300Hz | `[600, 3400]` | Tono grave, no molesto |

### 5. Previsualización

El select dispara una preview al cambiar de opción: `previewRingtone(id)` crea un AudioContext efímero, ejecuta el pattern UNA sola vez (sin loop), y cierra el contexto al terminar. No interfiere con el ring activo porque usa su propio AudioContext.

Para evitar audio fantasma si el usuario scrollea rápido por el dropdown, cada preview cancela la anterior (se trackea un `previewTimeoutId`).

### 6. Persistencia y estado en SocketContext

SocketContext mantiene:
- `selectedRingtoneId: string` — inicializado desde `localStorage.getItem('ringtone')` con fallback `'classic'`
- `setRingtone(id: string)` — guarda en localStorage y actualiza el state
- `previewRingtone(id: string)` — reproduce una vez

`startRing()` y `stopRing()` se mantienen en la interfaz pública del contexto. `startRing()` ahora recibe el ID internamente desde el state (no desde parámetro — se usa el seleccionado).
```

### 7. Integración en OperatorPanel

El `panel-main-header` actual:

```
┌──────────────────────────────────────────────────┐
│ Videollamada           [Modo superpuesto ■]       │
└──────────────────────────────────────────────────┘
```

Se convierte en:

```
┌──────────────────────────────────────────────────┐
│ Videollamada    [Ringtone ▼]  [Modo superpuesto ■]│
└──────────────────────────────────────────────────┘
```

El `<select>` de ringtone solo se muestra si el usuario tiene rol `operator` o `admin`. No aplica para `guard`.

## Risks / Trade-offs

- **[AudioContext limit]**: Chrome limita los AudioContext a ~6 simultáneos. Si el usuario hace preview rápido muchas veces, podría saturarse. → Mitigación: cada preview cierra su contexto al terminar; la preview anterior se cancela al iniciar una nueva.
- **[Sin melodías]**: El modelo paramétrico no soporta secuencias de notas porque todas las voces usan la misma frecuencia en cada paso ON. → Trade-off aceptado. Si en el futuro se quieren melodías, se puede extender `RingtoneDefinition` con `freqSequence: number[]` opcional que overriddee `voices[].freq` en cada paso.
- **[localStorage sin respaldo]**: Si el usuario limpia datos del navegador, pierde la preferencia. → Bajo impacto: vuelve al default 'classic'. No justifica complejidad de backend.
- **[Browser autoplay policy]**: La primera preview podría ser bloqueada si no hay interacción previa del usuario. → Mitigación: la preview siempre se dispara por un click explícito del usuario en el select, lo que satisface la política de autoplay.
