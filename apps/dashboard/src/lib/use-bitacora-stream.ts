import { useCallback, useEffect, useRef } from 'react';
import { apiBaseUrl, currentAccessToken } from './apiClient';

/** Where the server listens for new bitacora entries. */
const STREAM_PATH = '/api/bitacora/stream';

/** Wait before reconnecting after the stream drops, in milliseconds. */
const RECONNECT_DELAY_MS = 3_000;

export interface BitacoraStreamEvent {
  communityId: string;
  entryId: string;
  type: string;
  createdAt: string;
}

/**
 * Subscribes to the server stream of bitacora entries and calls `onEntry` for
 * every movement of the community.
 *
 * `EventSource` cannot send an Authorization header, and putting the JWT in the
 * query string would leak it into logs and history, so the stream is read with
 * `fetch` over a `ReadableStream` and the frames are parsed by hand: they are a
 * handful of lines per event.
 */
export function useBitacoraStream(options: {
  communityId: string | null | undefined;
  enabled?: boolean;
  onEntry: (event: BitacoraStreamEvent) => void;
}) {
  const { communityId, enabled = true, onEntry } = options;

  // The listener lives in a ref so a new callback on every render does not tear
  // the connection down and back up.
  const handler = useRef(onEntry);
  useEffect(() => {
    handler.current = onEntry;
  }, [onEntry]);

  const notify = useCallback((event: BitacoraStreamEvent) => {
    handler.current(event);
  }, []);

  useEffect(() => {
    if (!enabled || !communityId) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    let retry: number | null = null;
    let buffer = '';

    async function connect() {
      controller = new AbortController();
      const token = currentAccessToken();
      try {
        const response = await fetch(
          `${apiBaseUrl()}${STREAM_PATH}?communityId=${encodeURIComponent(communityId as string)}`,
          {
            headers: {
              Accept: 'text/event-stream',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            signal: controller.signal,
          },
        );
        if (!response.ok || !response.body) throw new Error('stream unavailable');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        buffer = '';

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Frames end with a blank line. Keep the tail in the buffer.
          let split = buffer.indexOf('\n\n');
          while (split !== -1) {
            const frame = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            split = buffer.indexOf('\n\n');

            const eventName = frame
              .split('\n')
              .find((line) => line.startsWith('event:'))
              ?.slice(6)
              .trim();
            if (eventName !== 'entry') continue;

            const data = frame
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('');
            if (!data) continue;

            try {
              notify(JSON.parse(data) as BitacoraStreamEvent);
            } catch {
              // A malformed frame is not worth tearing the stream down for.
            }
          }
        }
      } catch {
        // Either the network dropped or the server restarted; the retry below
        // rebuilds the connection either way.
      }

      if (cancelled) return;
      retry = window.setTimeout(connect, RECONNECT_DELAY_MS);
    }

    void connect();

    return () => {
      cancelled = true;
      if (retry !== null) window.clearTimeout(retry);
      controller?.abort();
    };
  }, [communityId, enabled, notify]);
}
