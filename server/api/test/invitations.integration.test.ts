import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.DYNAMIC_QR_ENABLED = 'false';
process.env.NODE_ENV = 'test';

import { createDb } from '@porteria/database';
import {
  accounts,
  communities,
  invitations,
  invitationUnits,
  locationResidents,
  locationStructures,
  locationUnits,
  memberships,
  organizations,
  people,
} from '@porteria/database/schema';

const db = createDb();

interface MailConfig {
  zeptomailApiUrl: string;
  zeptomailToken: string;
  from: string;
}

interface FetchCall {
  url: string;
  init?: RequestInit;
}

interface ZeptoPayload {
  from: { address: string; name: string };
  to: Array<{ email_address: { address: string } }>;
  subject: string;
  htmlbody: string;
  textbody: string;
}

type Json = Record<string, any>;

let app: FastifyInstance;
let organizationId: string;
let communityId: string;
let orgAdminToken: string;
let orgAdminPersonId: string;
let platformAdminToken: string;
let unitAId: string;
let unitBId: string;
let unitACode: string;
let unitBCode: string;
let otherUnitId: string;
let mailConfig: MailConfig;
let originalMailConfig: MailConfig;
let originalFetch: typeof globalThis.fetch;
let fetchCalls: FetchCall[] = [];
const personIds: string[] = [];
const accountIds: string[] = [];

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function request(method: 'POST' | 'PATCH', url: string, token: string, payload?: unknown) {
  return app.inject({
    method,
    url,
    headers: auth(token),
    payload: payload as Record<string, unknown> | undefined,
  });
}

function parse(response: { body: string }) {
  return JSON.parse(response.body) as Json;
}

function installFetchMock(handler?: (call: FetchCall) => Response | Promise<Response>) {
  fetchCalls = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: FetchCall = {
      url: typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url,
      init,
    };
    fetchCalls.push(call);
    if (handler) return handler(call);
    return new Response(JSON.stringify({ request_id: 'test-request' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
}

function parsePayload(call: FetchCall): ZeptoPayload {
  return JSON.parse(String(call.init?.body)) as ZeptoPayload;
}

async function createOrgAdminFixture(email: string) {
  const [person] = await db
    .insert(people)
    .values({
      firstName: 'Ines',
      lastName: 'Invitaciones',
      documentType: 'CC',
      documentNumber: `INV-${randomUUID().slice(0, 12)}`,
      contactEmail: email,
      status: 'active',
    })
    .returning();
  personIds.push(person.id);

  const [account] = await db
    .insert(accounts)
    .values({ personId: person.id, email, passwordHash: 'x' })
    .returning();
  accountIds.push(account.id);

  const [membership] = await db
    .insert(memberships)
    .values({
      personId: person.id,
      organizationId,
      communityId: null,
      role: 'org_admin',
      status: 'active',
    })
    .returning();

  return { person, account, membership };
}

async function createPlatformAdminFixture(email: string) {
  const [person] = await db
    .insert(people)
    .values({
      firstName: 'Pia',
      lastName: 'Plataforma',
      documentType: 'CC',
      documentNumber: `PLT-${randomUUID().slice(0, 12)}`,
      contactEmail: email,
      status: 'active',
    })
    .returning();
  personIds.push(person.id);

  const [account] = await db
    .insert(accounts)
    .values({ personId: person.id, email, passwordHash: 'x', isPlatformAdmin: true })
    .returning();
  accountIds.push(account.id);

  return { person, account };
}

async function createCommunityAdminFixture(email: string) {
  const [person] = await db
    .insert(people)
    .values({
      firstName: 'Cami',
      lastName: 'Comunidad',
      documentType: 'CC',
      documentNumber: `CMA-${randomUUID().slice(0, 12)}`,
      contactEmail: email,
      status: 'active',
    })
    .returning();
  personIds.push(person.id);

  const [account] = await db
    .insert(accounts)
    .values({ personId: person.id, email, passwordHash: 'x' })
    .returning();
  accountIds.push(account.id);

  const [membership] = await db
    .insert(memberships)
    .values({
      personId: person.id,
      organizationId,
      communityId,
      role: 'community_admin',
      status: 'active',
    })
    .returning();

  return { person, account, membership };
}

describe('invitation email delivery integration', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [organization] = await db
      .insert(organizations)
      .values({ name: `Invitation Mail Org ${suffix}`, slug: `invitation-mail-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Comunidad Correo ${suffix}`,
        slug: `invitation-mail-community-${suffix}`,
        address: 'Calle 1 #2-3',
        timezone: 'UTC',
      })
      .returning();
    communityId = community.id;

    const [structure] = await db
      .insert(locationStructures)
      .values({
        communityId,
        name: `Estructura ${suffix}`,
        levelCount: 2,
        level1Name: 'Torre',
        level2Name: 'Unidad',
      })
      .returning();

    const [tower] = await db
      .insert(locationUnits)
      .values({
        communityId,
        structureId: structure.id,
        levelPosition: 1,
        name: 'Torre A',
        code: `TA-${suffix}`,
        sectionType: 'tower',
      })
      .returning();

    const [unitA, unitB] = await db
      .insert(locationUnits)
      .values([
        {
          communityId,
          structureId: structure.id,
          parentId: tower.id,
          levelPosition: 2,
          name: 'Apartamento 101',
          code: `A-101-${suffix}`,
        },
        {
          communityId,
          structureId: structure.id,
          parentId: tower.id,
          levelPosition: 2,
          name: 'Apartamento 102',
          code: `A-102-${suffix}`,
        },
      ])
      .returning();
    unitAId = unitA.id;
    unitBId = unitB.id;
    unitACode = unitA.code!;
    unitBCode = unitB.code!;

    const [otherCommunity] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Comunidad Ajena ${suffix}`,
        slug: `invitation-other-community-${suffix}`,
        address: 'Calle 9 #9-9',
        timezone: 'UTC',
      })
      .returning();

    const [otherStructure] = await db
      .insert(locationStructures)
      .values({
        communityId: otherCommunity.id,
        name: `Estructura Ajena ${suffix}`,
        levelCount: 1,
        level1Name: 'Unidad',
      })
      .returning();

    const [otherUnit] = await db
      .insert(locationUnits)
      .values({
        communityId: otherCommunity.id,
        structureId: otherStructure.id,
        levelPosition: 1,
        name: 'Unidad ajena',
        code: `OT-${suffix}`,
      })
      .returning();
    otherUnitId = otherUnit.id;

    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const configModule = await import('../src/config.js');
    mailConfig = configModule.default.mail as MailConfig;
    originalMailConfig = { ...mailConfig };

    const fixture = await createOrgAdminFixture(`invitation-admin-${suffix}@test.local`);
    orgAdminPersonId = fixture.person.id;
    orgAdminToken = app.jwt.sign({
      sub: fixture.account.id,
      email: fixture.account.email,
      accountId: fixture.account.id,
      personId: fixture.person.id,
      orgId: organizationId,
      membershipId: fixture.membership.id,
      role: 'org_admin',
      communityId: null,
      unitId: null,
      isPlatformAdmin: false,
    });

    const platform = await createPlatformAdminFixture(`invitation-platform-${suffix}@test.local`);
    platformAdminToken = app.jwt.sign({
      sub: platform.account.id,
      email: platform.account.email,
      accountId: platform.account.id,
      personId: platform.person.id,
      orgId: organizationId,
      membershipId: 'platform',
      role: 'org_admin',
      communityId: null,
      unitId: null,
      isPlatformAdmin: true,
    });
  });

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    installFetchMock();
    Object.assign(mailConfig, {
      zeptomailApiUrl: 'https://api.zeptomail.test',
      zeptomailToken: 'test-zeptomail-token',
      from: 'Portería Virtual <no-reply@test.local>',
    } satisfies MailConfig);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.assign(mailConfig, originalMailConfig);
  });

  after(async () => {
    if (organizationId) {
      await db.delete(memberships).where(eq(memberships.organizationId, organizationId));
      await db.delete(invitations).where(eq(invitations.organizationId, organizationId));
      await db.delete(communities).where(eq(communities.organizationId, organizationId));
    }
    if (accountIds.length) await db.delete(accounts).where(inArray(accounts.id, accountIds));
    if (personIds.length) await db.delete(people).where(inArray(people.id, personIds));
    if (organizationId) await db.delete(organizations).where(eq(organizations.id, organizationId));
    await app.close();
  });

  it('sends the invitation through ZeptoMail when mail is configured', async () => {
    const email = `invite-mail-${randomUUID().slice(0, 8)}@test.local`;

    const response = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'community_admin',
      communityId,
    });

    assert.equal(response.statusCode, 201, response.body);
    const body = parse(response) as {
      invitation: { id: string };
      acceptUrl: string;
      emailSent: boolean;
    };
    assert.equal(body.emailSent, true);
    assert.equal(fetchCalls.length, 1);

    const call = fetchCalls[0];
    assert.equal(call.url, 'https://api.zeptomail.test/v1.1/email');

    const headers = new Headers(call.init?.headers);
    assert.equal(headers.get('authorization'), 'Zoho-enczapikey test-zeptomail-token');
    assert.equal(headers.get('content-type'), 'application/json');

    const payload = parsePayload(call);
    assert.deepEqual(payload.from, { address: 'no-reply@test.local', name: 'Portería Virtual' });
    assert.equal(payload.to[0].email_address.address, email);
    assert.match(payload.subject, /Comunidad Correo/);
    assert.match(payload.htmlbody, /Aceptar invitación/);
    assert.ok(payload.htmlbody.includes(body.acceptUrl));
    assert.ok(payload.textbody.includes(body.acceptUrl));
    assert.match(payload.htmlbody, /Si no esperabas esta invitación, ignora este correo\./);
    assert.ok(payload.htmlbody.includes('Administrador de comunidad'));
    assert.ok(!payload.htmlbody.includes('community_admin'));
  });

  it('strips a duplicated Zoho-enczapikey prefix from the token', async () => {
    Object.assign(mailConfig, {
      zeptomailToken: 'Zoho-enczapikey test-zeptomail-token',
    });

    const email = `invite-prefix-${randomUUID().slice(0, 8)}@test.local`;
    const response = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'community_admin',
      communityId,
    });

    assert.equal(response.statusCode, 201, response.body);
    assert.equal(parse(response).emailSent, true);
    assert.equal(fetchCalls.length, 1);

    const headers = new Headers(fetchCalls[0].init?.headers);
    assert.equal(headers.get('authorization'), 'Zoho-enczapikey test-zeptomail-token');
  });

  it('lets a platform superadmin create a community and email its administrator', async () => {
    const suffix = randomUUID().slice(0, 8);
    const created = await request('POST', '/api/platform/communities', platformAdminToken, {
      organizationId,
      name: `Comunidad Plataforma ${suffix}`,
      address: 'Calle Plataforma 1',
      timezone: 'UTC',
    });
    assert.equal(created.statusCode, 201, created.body);
    const community = parse(created) as { id: string };

    const email = `platform-community-admin-${suffix}@test.local`;
    const response = await request(
      'POST',
      `/api/platform/communities/${community.id}/invitations`,
      platformAdminToken,
      { email },
    );

    assert.equal(response.statusCode, 201, response.body);
    const body = parse(response) as {
      invitation: { id: string; role: string; communityId: string };
      acceptUrl: string;
      emailSent: boolean;
    };
    assert.equal(body.emailSent, true);
    assert.equal(body.invitation.role, 'community_admin');
    assert.equal(body.invitation.communityId, community.id);
    assert.match(body.acceptUrl, /\/invite\/[a-f0-9]+$/);
    assert.equal(fetchCalls.length, 1);

    const payload = parsePayload(fetchCalls[0]);
    assert.equal(payload.to[0].email_address.address, email);
    assert.ok(payload.htmlbody.includes(body.acceptUrl));
    assert.ok(payload.htmlbody.includes(`Comunidad Plataforma ${suffix}`));
  });

  it('returns the link when the platform invitation has no mail configured', async () => {
    Object.assign(mailConfig, { zeptomailToken: '', from: '' });

    const email = `platform-no-mail-${randomUUID().slice(0, 8)}@test.local`;
    const response = await request(
      'POST',
      `/api/platform/communities/${communityId}/invitations`,
      platformAdminToken,
      { email },
    );

    assert.equal(response.statusCode, 201, response.body);
    const body = parse(response) as {
      invitation: { id: string };
      acceptUrl: string;
      emailSent: boolean;
    };
    assert.equal(body.emailSent, false);
    assert.match(body.acceptUrl, /\/invite\/[a-f0-9]+$/);
    assert.equal(fetchCalls.length, 0);

    const [row] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, body.invitation.id))
      .limit(1);
    assert.equal(row?.status, 'pending');
  });

  it('returns the link when the platform invitation provider fails', async () => {
    installFetchMock(
      async () =>
        new Response(
          JSON.stringify({ error: { code: 'EM_500', message: 'Provider unavailable' } }),
          {
            status: 503,
            headers: { 'content-type': 'application/json' },
          },
        ),
    );

    const email = `platform-provider-error-${randomUUID().slice(0, 8)}@test.local`;
    const response = await request(
      'POST',
      `/api/platform/communities/${communityId}/invitations`,
      platformAdminToken,
      { email },
    );

    assert.equal(response.statusCode, 201, response.body);
    const body = parse(response) as { acceptUrl: string; emailSent: boolean };
    assert.equal(body.emailSent, false);
    assert.match(body.acceptUrl, /\/invite\/[a-f0-9]+$/);
    assert.equal(fetchCalls.length, 1);
  });

  it('reports emailSent when a platform superadmin assigns an organization administrator', async () => {
    const email = `platform-org-admin-${randomUUID().slice(0, 8)}@test.local`;
    const response = await request(
      'PATCH',
      `/api/platform/organizations/${organizationId}`,
      platformAdminToken,
      { administratorEmail: email },
    );

    assert.equal(response.statusCode, 200, response.body);
    const body = parse(response) as {
      administrator: {
        status: string;
        email: string;
        acceptUrl: string;
        emailSent: boolean;
      };
    };
    assert.equal(body.administrator.status, 'pending');
    assert.equal(body.administrator.email, email);
    assert.equal(body.administrator.emailSent, true);
    assert.match(body.administrator.acceptUrl, /\/invite\/[a-f0-9]+$/);
    assert.equal(fetchCalls.length, 1);

    const payload = parsePayload(fetchCalls[0]);
    assert.equal(payload.to[0].email_address.address, email);
    assert.ok(payload.htmlbody.includes(body.administrator.acceptUrl));
  });

  it('keeps the invitation when the mail settings are missing', async () => {
    const scenarios: Array<{ name: string; token: string; from: string }> = [
      { name: 'missing token', token: '', from: 'Portería Virtual <no-reply@test.local>' },
      { name: 'missing from', token: 'test-zeptomail-token', from: '' },
      { name: 'invalid from', token: 'test-zeptomail-token', from: 'not-an-address' },
    ];

    for (const scenario of scenarios) {
      Object.assign(mailConfig, {
        zeptomailToken: scenario.token,
        from: scenario.from,
      });

      const email = `invite-no-mail-${randomUUID().slice(0, 8)}@test.local`;
      const response = await request('POST', '/api/invitations', orgAdminToken, {
        email,
        role: 'community_admin',
        communityId,
      });

      assert.equal(response.statusCode, 201, `${scenario.name}: ${response.body}`);
      const body = parse(response) as { invitation: { id: string }; emailSent: boolean };
      assert.equal(body.emailSent, false, scenario.name);
      assert.ok(body.invitation.id, scenario.name);
    }

    assert.equal(fetchCalls.length, 0);
  });

  it('keeps the invitation when ZeptoMail responds with an error', async () => {
    installFetchMock(
      async () =>
        new Response(
          JSON.stringify({ error: { code: 'EM_500', message: 'Provider unavailable' } }),
          { status: 503, headers: { 'content-type': 'application/json' } },
        ),
    );

    const email = `invite-provider-error-${randomUUID().slice(0, 8)}@test.local`;
    const response = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'community_admin',
      communityId,
    });

    assert.equal(response.statusCode, 201, response.body);
    const body = parse(response) as { invitation: { id: string }; emailSent: boolean };
    assert.equal(body.emailSent, false);
    assert.equal(fetchCalls.length, 1);
  });

  it('keeps the invitation when the provider request rejects', async () => {
    installFetchMock(async () => {
      throw new Error('network down');
    });

    const email = `invite-network-error-${randomUUID().slice(0, 8)}@test.local`;
    const response = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'community_admin',
      communityId,
    });

    assert.equal(response.statusCode, 201, response.body);
    const body = parse(response) as { invitation: { id: string }; emailSent: boolean };
    assert.equal(body.emailSent, false);
    assert.equal(fetchCalls.length, 1);
  });

  it('records the creator as a person on the invitation', async () => {
    const email = `invite-creator-${randomUUID().slice(0, 8)}@test.local`;

    const response = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'community_admin',
      communityId,
    });

    assert.equal(response.statusCode, 201, response.body);
    const body = parse(response) as {
      invitation: { invitedByPersonId: string | null };
    };
    assert.equal(body.invitation.invitedByPersonId, orgAdminPersonId);
  });

  it('resends a fresh link and emails it', async () => {
    const email = `invite-resend-${randomUUID().slice(0, 8)}@test.local`;

    const created = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'community_admin',
      communityId,
    });
    assert.equal(created.statusCode, 201, created.body);
    const createdBody = parse(created) as {
      invitation: { id: string };
      acceptUrl: string;
      emailSent: boolean;
    };
    assert.equal(createdBody.emailSent, true);

    fetchCalls = [];

    const resent = await request(
      'POST',
      `/api/invitations/${createdBody.invitation.id}/resend`,
      orgAdminToken,
    );
    assert.equal(resent.statusCode, 200, resent.body);
    const resentBody = parse(resent) as { acceptUrl: string; emailSent: boolean };
    assert.equal(resentBody.emailSent, true);
    assert.notEqual(resentBody.acceptUrl, createdBody.acceptUrl);
    assert.equal(fetchCalls.length, 1);

    const payload = parsePayload(fetchCalls[0]);
    assert.equal(payload.to[0].email_address.address, email);
    assert.ok(payload.htmlbody.includes(resentBody.acceptUrl));
    assert.ok(!payload.htmlbody.includes(createdBody.acceptUrl));
  });

  it('revokes an invitation over POST and keeps the record', async () => {
    const email = `invite-revoke-${randomUUID().slice(0, 8)}@test.local`;

    const created = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'community_admin',
      communityId,
    });
    assert.equal(created.statusCode, 201, created.body);
    const createdBody = parse(created) as { invitation: { id: string } };

    const revoked = await request(
      'POST',
      `/api/invitations/${createdBody.invitation.id}/revoke`,
      orgAdminToken,
    );
    assert.equal(revoked.statusCode, 200, revoked.body);
    assert.equal(parse(revoked).status, 'revoked');

    const [row] = await db
      .select()
      .from(invitations)
      .where(eq(invitations.id, createdBody.invitation.id))
      .limit(1);
    assert.equal(row.status, 'revoked');

    const again = await request(
      'POST',
      `/api/invitations/${createdBody.invitation.id}/revoke`,
      orgAdminToken,
    );
    assert.equal(again.statusCode, 200, again.body);
    assert.equal(parse(again).status, 'revoked');
  });

  it('lets a platform superadmin revoke any invitation', async () => {
    const email = `invite-revoke-platform-${randomUUID().slice(0, 8)}@test.local`;

    const created = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'community_admin',
      communityId,
    });
    assert.equal(created.statusCode, 201, created.body);
    const createdBody = parse(created) as { invitation: { id: string } };

    const revoked = await request(
      'POST',
      `/api/invitations/${createdBody.invitation.id}/revoke`,
      platformAdminToken,
    );
    assert.equal(revoked.statusCode, 200, revoked.body);
    assert.equal(parse(revoked).status, 'revoked');
  });

  it('creates an invitation for several units and lists them', async () => {
    const email = `invite-multi-${randomUUID().slice(0, 8)}@test.local`;

    const created = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'resident',
      communityId,
      locationUnitIds: [unitAId, unitBId],
    });
    assert.equal(created.statusCode, 201, created.body);
    const createdBody = parse(created) as { invitation: { id: string } };

    const bridge = await db
      .select()
      .from(invitationUnits)
      .where(eq(invitationUnits.invitationId, createdBody.invitation.id));
    assert.equal(bridge.length, 2);
    assert.deepEqual(
      new Set(bridge.map((row) => row.locationUnitId)),
      new Set([unitAId, unitBId]),
    );

    const list = await app.inject({
      method: 'GET',
      url: '/api/invitations',
      headers: auth(orgAdminToken),
    });
    assert.equal(list.statusCode, 200, list.body);
    const invitationsList = parse(list) as unknown as Array<{
      id: string;
      units: Array<{ id: string; path: string }>;
    }>;
    const found = invitationsList.find((row) => row.id === createdBody.invitation.id);
    assert.ok(found);
    assert.equal(found.units.length, 2);
    assert.deepEqual(new Set(found.units.map((unit) => unit.id)), new Set([unitAId, unitBId]));
    assert.ok(found.units.some((unit) => unit.path.includes('Torre A')));
  });

  it('rejects a duplicate invitation for the same email and unit', async () => {
    const email = `invite-duplicate-${randomUUID().slice(0, 8)}@test.local`;

    const first = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'resident',
      communityId,
      locationUnitIds: [unitAId],
    });
    assert.equal(first.statusCode, 201, first.body);

    const second = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'resident',
      communityId,
      locationUnitIds: [unitAId],
    });
    assert.equal(second.statusCode, 409, second.body);

    const rows = await db.select().from(invitations).where(eq(invitations.email, email));
    assert.equal(rows.length, 1);
  });

  it('accepting a multi-unit invitation creates one membership and resident per unit', async () => {
    const email = `invite-accept-multi-${randomUUID().slice(0, 8)}@test.local`;

    const created = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'resident',
      communityId,
      locationUnitIds: [unitAId, unitBId],
    });
    assert.equal(created.statusCode, 201, created.body);
    const createdBody = parse(created) as { invitation: { id: string }; acceptUrl: string };
    const token = createdBody.acceptUrl.split('/').filter(Boolean).pop();
    assert.ok(token);

    const accepted = await app.inject({
      method: 'POST',
      url: `/api/public/invitations/${token}/accept`,
      payload: { name: 'Nueva Persona', password: 'ClaveSegura123' },
    });
    assert.equal(accepted.statusCode, 200, accepted.body);
    assert.equal(parse(accepted).membershipsCreated, 2);

    const [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    assert.ok(account);
    accountIds.push(account.id);
    personIds.push(account.personId);

    const createdMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.personId, account.personId));
    assert.equal(createdMemberships.length, 2);
    assert.deepEqual(
      new Set(createdMemberships.map((row) => row.locationUnitId)),
      new Set([unitAId, unitBId]),
    );

    const residents = await db
      .select()
      .from(locationResidents)
      .where(eq(locationResidents.personId, account.personId));
    assert.equal(residents.length, 2);
    assert.deepEqual(
      new Set(residents.map((row) => row.locationUnitId)),
      new Set([unitAId, unitBId]),
    );
  });

  it('rejects acceptance when every membership already exists without duplicating residents', async () => {
    const email = `invite-already-member-${randomUUID().slice(0, 8)}@test.local`;

    const created = await request('POST', '/api/invitations', orgAdminToken, {
      email,
      role: 'resident',
      communityId,
      locationUnitIds: [unitAId, unitBId],
    });
    assert.equal(created.statusCode, 201, created.body);
    const createdBody = parse(created) as { invitation: { id: string }; acceptUrl: string };
    const token = createdBody.acceptUrl.split('/').filter(Boolean).pop();
    assert.ok(token);

    const [person] = await db
      .insert(people)
      .values({
        firstName: 'Elena',
        lastName: 'Existente',
        documentType: 'CC',
        documentNumber: `EXI-${randomUUID().slice(0, 12)}`,
        contactEmail: email,
        status: 'active',
      })
      .returning();
    personIds.push(person.id);

    const [account] = await db
      .insert(accounts)
      .values({ personId: person.id, email, passwordHash: 'x' })
      .returning();
    accountIds.push(account.id);

    const existingMemberships = await db
      .insert(memberships)
      .values([
        {
          personId: person.id,
          organizationId,
          communityId,
          locationUnitId: unitAId,
          role: 'resident',
          status: 'active',
        },
        {
          personId: person.id,
          organizationId,
          communityId,
          locationUnitId: unitBId,
          role: 'resident',
          status: 'active',
        },
      ])
      .returning();

    await db.insert(locationResidents).values([
      {
        locationUnitId: unitAId,
        personId: person.id,
        relationship: 'resident',
        validFrom: '2026-01-01',
        status: 'active',
      },
      {
        locationUnitId: unitBId,
        personId: person.id,
        relationship: 'resident',
        validFrom: '2026-01-01',
        status: 'active',
      },
    ]);

    const sessionToken = app.jwt.sign({
      sub: account.id,
      email,
      accountId: account.id,
      personId: person.id,
      orgId: organizationId,
      membershipId: existingMemberships[0]?.id,
      role: 'resident',
      communityId,
      unitId: null,
      isPlatformAdmin: false,
    });

    const accepted = await app.inject({
      method: 'POST',
      url: `/api/public/invitations/${token}/accept`,
      headers: auth(sessionToken),
      payload: {},
    });
    assert.equal(accepted.statusCode, 409, accepted.body);

    const keptMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.personId, person.id));
    assert.equal(keptMemberships.length, 2);

    const keptResidents = await db
      .select()
      .from(locationResidents)
      .where(eq(locationResidents.personId, person.id));
    assert.equal(keptResidents.length, 2);
  });

  it('creates only the valid rows of a bulk invitation and reports the rest', async () => {
    const suffix = randomUUID().slice(0, 8);
    const validA = `invite-bulk-a-${suffix}@test.local`;
    const validB = `invite-bulk-b-${suffix}@test.local`;

    const response = await request('POST', '/api/invitations/bulk', orgAdminToken, {
      communityId,
      rows: [
        { unit: unitACode, email: validA, name: 'Ana Lote' },
        { unit: `NO-EXISTE-${suffix}`, email: `invite-bulk-c-${suffix}@test.local` },
        { unit: unitACode, email: validA, name: 'Ana Duplicada' },
        { unit: unitBCode, email: validB, name: 'Beto Lote' },
      ],
    });
    assert.equal(response.statusCode, 201, response.body);
    const body = parse(response) as {
      summary: { total: number; created: number; failed: number };
      rows: Array<{ index: number; status: string; reason?: string }>;
    };

    assert.deepEqual(body.summary, {
      total: 4,
      valid: 0,
      created: 2,
      skipped: 0,
      failed: 2,
    });
    assert.equal(body.rows[0]?.status, 'created');
    assert.equal(body.rows[1]?.status, 'failed');
    assert.equal(body.rows[1]?.reason, 'unit_not_found');
    assert.equal(body.rows[2]?.status, 'failed');
    assert.equal(body.rows[2]?.reason, 'duplicate_row');
    assert.equal(body.rows[3]?.status, 'created');

    const createdRows = await db
      .select()
      .from(invitations)
      .where(inArray(invitations.email, [validA, validB]));
    assert.equal(createdRows.length, 2);

    for (const invitation of createdRows) {
      const units = await db
        .select()
        .from(invitationUnits)
        .where(eq(invitationUnits.invitationId, invitation.id));
      assert.equal(units.length, 1);
    }
  });

  it('blocks a community admin from inviting a unit of another community', async () => {
    const suffix = randomUUID().slice(0, 8);
    const fixture = await createCommunityAdminFixture(`invite-community-admin-${suffix}@test.local`);
    const communityAdminToken = app.jwt.sign({
      sub: fixture.account.id,
      email: fixture.account.email,
      accountId: fixture.account.id,
      personId: fixture.person.id,
      orgId: organizationId,
      membershipId: fixture.membership.id,
      role: 'community_admin',
      communityId,
      unitId: null,
      isPlatformAdmin: false,
    });
    const email = `invite-foreign-unit-${suffix}@test.local`;

    const response = await request('POST', '/api/invitations', communityAdminToken, {
      email,
      role: 'resident',
      communityId,
      locationUnitIds: [otherUnitId],
    });
    assert.equal(response.statusCode, 400, response.body);

    const rows = await db.select().from(invitations).where(eq(invitations.email, email));
    assert.equal(rows.length, 0);
  });
});
