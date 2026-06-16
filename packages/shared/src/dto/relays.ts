export interface TriggerRelayDto {
  kioskId: string;
  relayIndex: number;
  mode: 'momentary' | 'latch';
  durationMs?: number;
}

export interface RelayConfigDto {
  id: string;
  relayIndex: number;
  gpioPin: number;
  label: string;
  mode: 'momentary' | 'latch';
  durationMs: number | null;
  accessPointId: string | null;
}
