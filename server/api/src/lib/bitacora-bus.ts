import { EventEmitter } from 'node:events';

/**
 * A bitacora entry that just landed. The event carries only what a board needs to
 * decide whether to refetch, never the row itself: the reader already has an
 * endpoint with the filters and the access rules.
 */
export interface BitacoraEvent {
  communityId: string;
  entryId: string;
  type: string;
  createdAt: string;
}

/**
 * In-process fan-out. It works with a single API instance, which is what we run
 * today; the day a second one appears, the transport behind these two functions
 * becomes Redis pub/sub and nothing else changes.
 */
const bus = new EventEmitter();

// One listener per open dashboard tab; the default ceiling of 10 would warn as
// soon as an office has a couple of screens open.
bus.setMaxListeners(0);

export function publishBitacoraEvent(event: BitacoraEvent): void {
  bus.emit('entry', event);
}

export function onBitacoraEvent(listener: (event: BitacoraEvent) => void): () => void {
  bus.on('entry', listener);
  return () => {
    bus.off('entry', listener);
  };
}
