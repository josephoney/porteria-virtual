import type { EventType } from '../enums/index.js';

export interface EventMetadata {
  [key: string]: unknown;
}

export interface Event {
  id: string;
  eventType: EventType;
  actorId: string | null;
  actorRole: string | null;
  organizationId: string;
  communityId: string | null;
  accessPointId: string | null;
  metadata: EventMetadata;
  createdAt: Date;
}
