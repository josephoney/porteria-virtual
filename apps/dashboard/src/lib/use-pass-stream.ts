import { useEffect, useRef } from 'react';

import { apiBaseUrl, currentAccessToken } from './apiClient';

/** Shape the server writes on `event: pass`. */
export interface PassStreamEvent {
  personId: string;
  passId: string;
  status: string;
}

const STREAM_PATH = '/api/passes/stream';
const RECONNECT_DELAY_MS = 3000;

/**
 * Keeps a resident's screens in sync with their own passes.
 *
 * `EventSource` would be the obvious choice, but it cannot send headers and the
 * session travels as a bearer token, so the stream is read from a plain `fetch`
 * response instead of putting the token in the URL.
 */
export function usePassStream({
  enabled = true,
  onEvent,
}: {
  enabled?: boolean;
  onEvent: (event: PassStreamEvent) => void;
}) {
  // Kept in a ref so a new callback on every render does not reopen the stream.
  const handler = useRef(onEvent);
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let controller: AbortController | null = null;
    let retry: number | undefined;

    async function connect() {
      if (cancelled) return;
      controller = new AbortController();
      const token = currentAccessToken();

      try {
        const response = await fetch(`${apiBaseUrl()}${STREAM_PATH}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
            Accept: 'text/event-stream',
          },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error('stream_unavailable');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf('\n\n');
          while (boundary >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            boundary = buffer.indexOf('\n\n');

            if (!frame.startsWith('event: pass')) continue;
            const data = frame
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('');
            if (!data) continue;
            try {
              handler.current(JSON.parse(data) as PassStreamEvent);
            } catch {
              // A malformed frame is not worth tearing the stream down.
            }
          }
        }
      } catch {
        // Aborted on unmount, or the connection dropped: both fall through to the
        // retry below, which reconnects and lets the caller refetch.
      }

      if (!cancelled) retry = window.setTimeout(connect, RECONNECT_DELAY_MS);
    }

    void connect();

    return () => {
      cancelled = true;
      controller?.abort();
      if (retry) window.clearTimeout(retry);
    };
  }, [enabled]);
}
