import { EventEmitter } from 'node:events';

/**
 * In-process bus for pass status changes.
 *
 * It exists apart from `bitacora-bus` on purpose: the bitacora emits per
 * community, and a resident subscribed to that stream would learn about other
 * people's movements. Here every event carries the person it belongs to, so a
 * resident can only ever receive their own.
 *
 * When the API runs as more than one instance this moves to Redis pub/sub; the
 * rest of the code does not change.
 */
export interface PassEvent {
  /** Person that created the pass. Only that session receives the event. */
  personId: string;
  passId: string;
  status: string;
}

const bus = new EventEmitter();
// Boards can hold one subscription per open tab, and the default cap of ten
// would print a leak warning during a normal day.
bus.setMaxListeners(0);

export function publishPassEvent(event: PassEvent) {
  bus.emit('pass', event);
}

export function onPassEvent(listener: (event: PassEvent) => void): () => void {
  bus.on('pass', listener);
  return () => {
    bus.off('pass', listener);
  };
}
