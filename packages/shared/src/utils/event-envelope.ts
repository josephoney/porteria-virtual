import type { EventEnvelope } from '../types/outbox.js';

export interface CreateEventEnvelopeInput {
  eventType: string;
  organizationId: string;
  communityId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  accessPointId?: string | null;
  payload?: Record<string, unknown>;
  version?: number;
}

export function createEventEnvelope(input: CreateEventEnvelopeInput): EventEnvelope {
  return {
    eventId: crypto.randomUUID(),
    eventType: input.eventType,
    version: input.version ?? 1,
    occurredAt: new Date().toISOString(),
    organizationId: input.organizationId,
    communityId: input.communityId ?? null,
    actor:
      input.actorId && input.actorRole
        ? { id: input.actorId, role: input.actorRole }
        : null,
    actorRole: input.actorRole ?? null,
    accessPointId: input.accessPointId ?? null,
    payload: input.payload ?? {},
  };
}
