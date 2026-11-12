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

export interface OutboxTopicStats {
  pending: number;
  processing: number;
  done: number;
  dead: number;
  oldestPendingAge: number;
  lastError: string | null;
}

/**
 * Totals across every topic plus the per-topic breakdown. The flat fields stay
 * for existing consumers; `topics` is what the workers use to watch their own
 * queue without being confused by another topic's backlog.
 */
export interface OutboxStats extends OutboxTopicStats {
  topics: Record<string, OutboxTopicStats>;
}
