import type { KioskData, OperatorData, CallData } from './types.js';

export interface SignalingState {
  kiosks: Map<string, KioskData>;
  operators: Map<string, OperatorData>;
  calls: Map<string, CallData>;
  callTimeouts: Map<string, NodeJS.Timeout>;
}

export function createState(): SignalingState {
  return {
    kiosks: new Map(),
    operators: new Map(),
    calls: new Map(),
    callTimeouts: new Map(),
  };
}
