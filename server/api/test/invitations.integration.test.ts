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
});
