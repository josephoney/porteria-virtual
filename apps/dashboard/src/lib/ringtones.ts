export interface RingtoneVoice {
  freq: number;
  type: OscillatorType;
  gain: number;
}

export interface RingtoneDefinition {
  id: string;
  name: string;
  description: string;
  voices: RingtoneVoice[];
  pattern: number[];
}

export const RINGTONE_DEFINITIONS: RingtoneDefinition[] = [
  {
    id: 'classic',
    name: 'Clásico',
    description: 'Doble tono telefónico estándar',
    voices: [
      { freq: 800, type: 'sine', gain: 0.12 },
      { freq: 1000, type: 'sine', gain: 0.12 },
    ],
    pattern: [900, 2200],
  },
  {
    id: 'digital',
    name: 'Digital',
    description: 'Triple beep electrónico',
    voices: [{ freq: 1200, type: 'square', gain: 0.08 }],
    pattern: [150, 80, 150, 80, 150, 1390],
  },
  {
    id: 'soft',
    name: 'Suave',
    description: 'Ping sutil, no invasivo',
    voices: [{ freq: 600, type: 'sine', gain: 0.06 }],
    pattern: [300, 2700],
  },
  {
    id: 'oldphone',
    name: 'Teléfono',
    description: 'Ring largo estilo europeo',
    voices: [{ freq: 425, type: 'sine', gain: 0.15 }],
    pattern: [1000, 4000],
  },
  {
    id: 'pulse',
    name: 'Pulso',
    description: 'Pulsos rápidos electrónicos',
    voices: [{ freq: 800, type: 'sawtooth', gain: 0.06 }],
    pattern: [100, 100, 100, 100, 100, 100, 100, 1300],
  },
  {
    id: 'alarm',
    name: 'Alarma',
    description: 'Urgente, doble tono alto',
    voices: [
      { freq: 1000, type: 'square', gain: 0.08 },
      { freq: 1200, type: 'square', gain: 0.08 },
    ],
    pattern: [250, 250, 250, 250, 250, 1750],
  },
  {
    id: 'buzzer',
    name: 'Timbre',
    description: 'Zumbido de portero eléctrico',
    voices: [
      { freq: 650, type: 'sawtooth', gain: 0.12 },
      { freq: 850, type: 'sawtooth', gain: 0.12 },
    ],
    pattern: [350, 150, 350, 150, 350, 1650],
  },
  {
    id: 'knock',
    name: 'Golpe',
    description: 'Knock-knock rítmico',
    voices: [{ freq: 440, type: 'triangle', gain: 0.1 }],
    pattern: [80, 80, 80, 280, 80, 80, 80, 1240],
  },
  {
    id: 'highbeep',
    name: 'Agudo',
    description: 'Beeps cortos de alta frecuencia',
    voices: [{ freq: 1500, type: 'sine', gain: 0.07 }],
    pattern: [200, 150, 200, 2450],
  },
  {
    id: 'deep',
    name: 'Profundo',
    description: 'Tono grave, no molesto',
    voices: [{ freq: 300, type: 'sine', gain: 0.18 }],
    pattern: [600, 3400],
  },
];

export const DEFAULT_RINGTONE_ID = 'classic';

export function getRingtoneDefinition(
  id: string,
): RingtoneDefinition | undefined {
  return RINGTONE_DEFINITIONS.find((r) => r.id === id);
}

export function createRingPlayer(def: RingtoneDefinition): {
  start: () => boolean;
  stop: () => void;
} {
  let ctx: AudioContext | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let stepIndex = 0;
  let cancelled = false;

  function scheduleStep() {
    if (cancelled || !ctx || ctx.state === 'closed') return;

    const step = stepIndex % def.pattern.length;
    const duration = def.pattern[step];
    const isOn = step % 2 === 0;

    if (isOn) {
      const oscillators: OscillatorNode[] = [];
      try {
        for (const voice of def.voices) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = voice.type;
          osc.frequency.value = voice.freq;
          gain.gain.value = voice.gain;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          oscillators.push(osc);
        }
      } catch {
        /* ctx may have closed during setup */
      }

      timeoutId = setTimeout(() => {
        oscillators.forEach((o) => {
          try {
            o.stop();
          } catch {
            /* already stopped */
          }
        });
        stepIndex++;
        scheduleStep();
      }, duration);
    } else {
      timeoutId = setTimeout(() => {
        stepIndex++;
        scheduleStep();
      }, duration);
    }
  }

  return {
    start(): boolean {
      if (ctx) return true;
      try {
        ctx = new AudioContext();
      } catch {
        return false;
      }
      cancelled = false;
      stepIndex = 0;
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => {
          if (!cancelled && ctx) scheduleStep();
        }).catch(() => {});
      } else {
        scheduleStep();
      }
      return true;
    },
    stop() {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (ctx) {
        ctx.close().catch(() => {});
        ctx = null;
      }
    },
  };
}

let previewTimeoutId: ReturnType<typeof setTimeout> | null = null;
let previewCtx: AudioContext | null = null;

export function previewRingtone(def: RingtoneDefinition): void {
  if (previewTimeoutId) {
    clearTimeout(previewTimeoutId);
    previewTimeoutId = null;
  }
  if (previewCtx) {
    previewCtx.close().catch(() => {});
    previewCtx = null;
  }

  try {
    previewCtx = new AudioContext();
  } catch {
    return;
  }

  let stepIndex = 0;
  const ctx = previewCtx;

  function schedulePreviewStep() {
    if (!ctx || ctx.state === 'closed') return;
    if (stepIndex >= def.pattern.length) {
      ctx.close().catch(() => {});
      previewCtx = null;
      return;
    }

    const duration = def.pattern[stepIndex];
    const isOn = stepIndex % 2 === 0;

    if (isOn) {
      const oscillators: OscillatorNode[] = [];
      try {
        for (const voice of def.voices) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = voice.type;
          osc.frequency.value = voice.freq;
          gain.gain.value = voice.gain;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          oscillators.push(osc);
        }
      } catch {
        /* ctx may have closed */
      }

      previewTimeoutId = setTimeout(() => {
        oscillators.forEach((o) => {
          try {
            o.stop();
          } catch {
            /* already stopped */
          }
        });
        stepIndex++;
        schedulePreviewStep();
      }, duration);
    } else {
      previewTimeoutId = setTimeout(() => {
        stepIndex++;
        schedulePreviewStep();
      }, duration);
    }
  }

  if (ctx.state === 'suspended') {
    ctx.resume().then(() => schedulePreviewStep()).catch(() => {});
  } else {
    schedulePreviewStep();
  }
}
