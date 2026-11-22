import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { eq, inArray } from 'drizzle-orm';

process.env.OUTBOX_WORKER_ENABLED = 'false';

import { createDb } from '@porteria/database';
import { accounts, events, organizations, people } from '@porteria/database/schema';
import { listEvents } from '../src/services/events.service.js';

const db = createDb();

const runId = randomUUID().slice(0, 8);
const organizationId = randomUUID();
const accountId = randomUUID();
const unknownActorId = randomUUID();
const personIds: string[] = [];

describe('events integration', () => {
  before(async () => {
    await db.insert(organizations).values({
      id: organizationId,
      name: `qa-events-${runId}`,
      slug: `qa-events-${runId}`,
    });

    const personByAccount = randomUUID();
    const personDirect = randomUUID();
    personIds.push(personByAccount, personDirect);

    await db.insert(people).values([
      { id: personByAccount, firstName: 'Cuenta', lastName: 'Nueva' },
      { id: personDirect, firstName: 'Persona', lastName: 'Directa' },
    ]);

    await db.insert(accounts).values({
      id: accountId,
      personId: personByAccount,
      email: `qa-events-account-${runId}@test.local`,
      passwordHash: 'not-used',
    });

    await db.insert(events).values([
      {
        eventType: 'qa.account.actor',
        actorId: accountId,
        organizationId,
      },
      {
        eventType: 'qa.person.actor',
        actorPersonId: personDirect,
        organizationId,
      },
      {
        eventType: 'qa.unknown.actor',
        actorId: unknownActorId,
        organizationId,
      },
    ]);
  });

  after(async () => {
    await db.delete(events).where(eq(events.organizationId, organizationId));
    await db.delete(accounts).where(eq(accounts.id, accountId));
    if (personIds.length > 0) {
      await db.delete(people).where(inArray(people.id, personIds));
    }
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  });

  it('resuelve el nombre del actor por persona y por cuenta', async () => {
    const result = await listEvents(organizationId, { page: 1, pageSize: 50 });
    const byType = new Map(result.data.map((event) => [event.eventType, event]));

    assert.equal(byType.get('qa.account.actor')?.actorName, 'Cuenta Nueva');
    assert.equal(byType.get('qa.person.actor')?.actorName, 'Persona Directa');
    // Un actor que ya no existe en people ni en accounts no rompe la consulta:
    // la tabla legada `users` se retiró y no hay un tercer fallback.
    assert.equal(byType.get('qa.unknown.actor')?.actorName, null);
  });
});
