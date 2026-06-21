import { config } from './config.js';

let log: { warn: (obj: Record<string, unknown>, msg: string) => void };

export function setPersistLogger(logger: typeof log) {
  log = logger;
}

function apiHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Internal-Key': config.INTERNAL_API_KEY,
  };
}

export async function persistCallRequest(
  callId: string,
  buildingId: string,
  visitor?: { name?: string; known?: boolean; similarity?: number } | null,
) {
  try {
    const res = await fetch(`${config.API_BASE_URL}/api/internal/calls`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ callId, buildingId, visitor }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      log?.warn(
        { callId, buildingId, status: res.status, body },
        'Failed to persist call request',
      );
    }
  } catch (err) {
    log?.warn({ callId, err: (err as Error).message }, 'Failed to persist call request (network)');
  }
}

export async function persistCallAccept(callId: string, operatorId: string) {
  try {
    const res = await fetch(`${config.API_BASE_URL}/api/internal/calls/${callId}`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify({ status: 'active', operatorId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      log?.warn(
        { callId, operatorId, status: res.status, body },
        'Failed to persist call accept',
      );
    }
  } catch (err) {
    log?.warn({ callId, err: (err as Error).message }, 'Failed to persist call accept (network)');
  }
}

export async function persistCallEnd(
  callId: string,
  status: 'ended' | 'missed',
  endedAt: number,
  duration?: number,
) {
  const body: Record<string, unknown> = {
    status,
    endedAt: new Date(endedAt).toISOString(),
    eventType: status === 'missed' ? 'call.missed' : 'call.ended',
  };
  if (duration !== undefined) body.duration = duration;

  try {
    const res = await fetch(`${config.API_BASE_URL}/api/internal/calls/${callId}`, {
      method: 'PATCH',
      headers: apiHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      log?.warn(
        { callId, status: res.status, body: errBody },
        'Failed to persist call end',
      );
    }
  } catch (err) {
    log?.warn({ callId, err: (err as Error).message }, 'Failed to persist call end (network)');
  }
}

export async function persistRelayTrigger(
  kioskId: string,
  relayIndex: number,
) {
  try {
    const res = await fetch(`${config.API_BASE_URL}/api/internal/relays/trigger`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ kioskId, relayIndex }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      log?.warn(
        { kioskId, relayIndex, status: res.status, body },
        'Failed to trigger relay',
      );
    }
  } catch (err) {
    log?.warn({ kioskId, relayIndex, err: (err as Error).message }, 'Failed to trigger relay (network)');
  }
}

export async function persistDoorRelay(
  kioskId: string,
) {
  try {
    const res = await fetch(`${config.API_BASE_URL}/api/internal/relays/trigger`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ kioskId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      log?.warn(
        { kioskId, status: res.status, body },
        'Failed to trigger door relay',
      );
    }
  } catch (err) {
    log?.warn({ kioskId, err: (err as Error).message }, 'Failed to trigger door relay (network)');
  }
}

export async function persistEvent(
  eventType: string,
  buildingId: string,
  extra?: { actorId?: string; actorRole?: string; accessPointId?: string; locationId?: string; metadata?: Record<string, unknown> },
) {
  try {
    const body: Record<string, unknown> = { eventType, buildingId, ...extra };
    const res = await fetch(`${config.API_BASE_URL}/api/internal/events`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      log?.warn(
        { eventType, buildingId, status: res.status, body: errBody },
        'Failed to persist event',
      );
    }
  } catch (err) {
    log?.warn({ eventType, buildingId, err: (err as Error).message }, 'Failed to persist event (network)');
  }
}
