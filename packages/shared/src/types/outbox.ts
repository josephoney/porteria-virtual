export interface EventEnvelope {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  organizationId: string;
  communityId?: string | null;
  actor?: {
    id: string;
    role: string;
  } | null;
  actorRole?: string | null;
  accessPointId?: string | null;
  payload: Record<string, unknown>;
}

export interface OutboxStats {
  pending: number;
  processing: number;
  done: number;
  dead: number;
  oldestPendingAge: number;
  lastError: string | null;
}
