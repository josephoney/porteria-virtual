import { config } from './config.js';
import { createDb } from '@porteria/database';
import { outboxEvents } from '@porteria/database/schema';
import { createEventEnvelope } from '@porteria/shared';

const db = createDb();

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
  kioskId: string,
  visitor?: { name?: string; known?: boolean; similarity?: number } | null,
) {
  try {
    const res = await fetch(`${config.API_BASE_URL}/api/internal/calls`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ callId, kioskId, visitor }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      log?.warn(
        { callId, kioskId, status: res.status, body },
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

export async function persistRelayTrigger(kioskId: string, relayIndex: number) {
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

export async function persistDoorRelay(kioskId: string) {
  try {
    const res = await fetch(`${config.API_BASE_URL}/api/internal/relays/trigger`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ kioskId }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      log?.warn({ kioskId, status: res.status, body }, 'Failed to trigger door relay');
    }
  } catch (err) {
    log?.warn({ kioskId, err: (err as Error).message }, 'Failed to trigger door relay (network)');
  }
}

export async function persistEvent(
  eventType: string,
  context: {
    organizationId: string;
    communityId?: string | null;
    actorId?: string;
    actorRole?: string;
    accessPointId?: string;
    metadata?: Record<string, unknown>;
  },
) {
  try {
    const envelope = createEventEnvelope({
      eventType,
      organizationId: context.organizationId,
      communityId: context.communityId ?? null,
      actorId: context.actorId ?? null,
      actorRole: context.actorRole ?? null,
      accessPointId: context.accessPointId ?? null,
      payload: context.metadata ?? {},
    });

    await db
      .insert(outboxEvents)
      .values({
        eventId: envelope.eventId,
        eventType: envelope.eventType,
        organizationId: envelope.organizationId,
        communityId: envelope.communityId ?? null,
        payload: envelope.payload,
        envelope,
      })
      .onConflictDoNothing({ target: outboxEvents.eventId });
  } catch (err) {
    log?.warn(
      { eventType, err: (err as Error).message },
      'Failed to persist event in outbox',
    );
  }
}
