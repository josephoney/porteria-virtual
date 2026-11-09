import type { FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { communities } from '@porteria/database/schema';
import { insertEvent } from './events.service.js';
import type { DbExecutor } from './outbox.service.js';

const db = createDb();

export async function auditCommunityEvent(input: {
  request: FastifyRequest;
  communityId: string;
  eventType: string;
  metadata: Record<string, unknown>;
  executor?: DbExecutor;
}): Promise<void> {
  const executor = input.executor ?? db;
  const [community] = await executor
    .select({ organizationId: communities.organizationId })
    .from(communities)
    .where(eq(communities.id, input.communityId))
    .limit(1);

  if (!community) return;

  await insertEvent({
    eventType: input.eventType,
    actorId: input.request.user.sub,
    actorPersonId: input.request.user.personId ?? null,
    actorRole: input.request.user.role,
    organizationId: community.organizationId,
    communityId: input.communityId,
    metadata: input.metadata,
  }, executor);
}
