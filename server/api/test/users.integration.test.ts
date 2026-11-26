import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.DYNAMIC_QR_ENABLED = 'false';
process.env.NODE_ENV = 'test';
// Sin proveedor de correo el alta devuelve el enlace de activación una vez.
process.env.ZEPTOMAIL_TOKEN = '';
process.env.MAIL_FROM = '';

import { createDb } from '@porteria/database';
import {
  accounts,
  communities,
  memberships,
  organizations,
  people,
} from '@porteria/database/schema';

const db = createDb();

let app: FastifyInstance;
let organizationId: string;
let communityAId: string;
let communityBId: string;
let communityAName: string;
let communityBName: string;
let orgAdminPersonId: string;
let orgAdminAccountId: string;
let orgAdminMembershipId: string;
let orgAdminToken: string;
let communityAdminPersonId: string;
let communityAdminAccountId: string;
let communityAdminMembershipId: string;
let communityAdminToken: string;
let multiAccountId: string;
let anaAccountId: string;
let carlaAccountId: string;
let activationEmail = '';
let activationAccountId = '';
let activationToken = '';
const personIds: string[] = [];
const createdEmails: string[] = [];

type Json = Record<string, any>;

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

async function request(
  method: 'GET' | 'POST' | 'PATCH',
  url: string,
  token: string,
  payload?: unknown,
) {
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

async function createUserFixture(input: {
  suffix: string;
  key: string;
  email: string;
  userName: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  active?: boolean;
  role: string;
  communityId: string | null;
}) {
  const [person] = await db
    .insert(people)
    .values({
      firstName: input.firstName,
      lastName: input.lastName,
      documentType: 'CC',
      documentNumber: input.documentNumber,
      status: 'active',
    })
    .returning();
  personIds.push(person.id);

  const [account] = await db
    .insert(accounts)
    .values({
      personId: person.id,
      email: input.email,
      passwordHash: 'x',
      active: input.active ?? true,
    })
    .returning();

  const [membership] = await db
    .insert(memberships)
    .values({
      personId: person.id,
      organizationId,
      communityId: input.communityId,
      role: input.role,
      status: 'active',
    })
    .returning();

  return { person, account, membership };
}

describe('users list filters integration', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);

    const [organization] = await db
      .insert(organizations)
      .values({ name: `Users Test Org ${suffix}`, slug: `users-test-org-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [communityA, communityB] = await db
      .insert(communities)
      .values([
        {
          organizationId,
          name: `Comunidad A ${suffix}`,
          slug: `users-test-a-${suffix}`,
          address: 'Calle A 1',
          timezone: 'UTC',
        },
        {
          organizationId,
          name: `Comunidad B ${suffix}`,
          slug: `users-test-b-${suffix}`,
          address: 'Calle B 2',
          timezone: 'UTC',
        },
      ])
      .returning();
    communityAId = communityA.id;
    communityBId = communityB.id;
    communityAName = communityA.name;
    communityBName = communityB.name;

    const orgAdmin = await createUserFixture({
      suffix,
      key: 'org-admin',
      email: `users-org-admin-${suffix}@test.local`,
      userName: 'Org Admin',
      firstName: 'Olga',
      lastName: 'Administradora',
      documentNumber: `90${suffix}`,
      role: 'org_admin',
      communityId: null,
    });
    orgAdminPersonId = orgAdmin.person.id;
    orgAdminAccountId = orgAdmin.account.id;
    orgAdminMembershipId = orgAdmin.membership.id;

    const communityAdmin = await createUserFixture({
      suffix,
      key: 'community-admin',
      email: `users-community-admin-${suffix}@test.local`,
      userName: 'Community Admin',
      firstName: 'Camilo',
      lastName: 'Administrador',
      documentNumber: `91${suffix}`,
      role: 'community_admin',
      communityId: communityAId,
    });
    communityAdminPersonId = communityAdmin.person.id;
    communityAdminAccountId = communityAdmin.account.id;
    communityAdminMembershipId = communityAdmin.membership.id;

    const ana = await createUserFixture({
      suffix,
      key: 'ana',
      email: `ana.lopez-${suffix}@test.local`,
      userName: 'Ana Lopez',
      firstName: 'Ana',
      lastName: 'López',
      documentNumber: `12345678-${suffix}`,
      role: 'resident',
      communityId: communityAId,
    });
    anaAccountId = ana.account.id;

    await createUserFixture({
      suffix,
      key: 'bruno',
      email: `bruno.diaz-${suffix}@test.local`,
      userName: 'Bruno Diaz',
      firstName: 'Bruno',
      lastName: 'Díaz',
      documentNumber: `87654321-${suffix}`,
      role: 'guard',
      communityId: communityAId,
    });

    const carla = await createUserFixture({
      suffix,
      key: 'carla',
      email: `carla.ruiz-${suffix}@test.local`,
      userName: 'Carla Ruiz',
      firstName: 'Carla',
      lastName: 'Ruiz',
      documentNumber: `55555555-${suffix}`,
      active: false,
      role: 'resident',
      communityId: communityBId,
    });
    carlaAccountId = carla.account.id;

    const multi = await createUserFixture({
      suffix,
      key: 'multi',
      email: `multi-${suffix}@test.local`,
      userName: 'Multi Comunidad',
      firstName: 'Marta',
      lastName: 'Multi',
      documentNumber: `44444444-${suffix}`,
      role: 'resident',
      communityId: communityAId,
    });
    multiAccountId = multi.account.id;
    await db.insert(memberships).values({
      personId: multi.person.id,
      organizationId,
      communityId: communityBId,
      role: 'owner',
      status: 'active',
    });

    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const base = {
      email: `user-${suffix}@test.local`,
      orgId: organizationId,
      unitId: null,
      isPlatformAdmin: false,
    };

    orgAdminToken = app.jwt.sign({
      ...base,
      sub: orgAdminAccountId,
      accountId: orgAdminAccountId,
      personId: orgAdminPersonId,
      membershipId: orgAdminMembershipId,
      role: 'org_admin',
      communityId: null,
    });

    communityAdminToken = app.jwt.sign({
      ...base,
      sub: communityAdminAccountId,
      accountId: communityAdminAccountId,
      personId: communityAdminPersonId,
      membershipId: communityAdminMembershipId,
      role: 'community_admin',
      communityId: communityAId,
    });
  });

  after(async () => {
    if (createdEmails.length) {
      await db.delete(accounts).where(inArray(accounts.email, createdEmails));
      await db.delete(people).where(inArray(people.contactEmail, createdEmails));
    }
    await db.delete(memberships).where(eq(memberships.organizationId, organizationId));
    if (personIds.length) {
      await db.delete(people).where(inArray(people.id, personIds));
    }
    await db.delete(organizations).where(eq(organizations.id, organizationId));
    await app.close();
  });

  it('returns the scoped total and the filtered total', async () => {
    const all = await request('GET', '/api/users?page=1&pageSize=50', orgAdminToken);
    assert.equal(all.statusCode, 200, all.body);
    const allBody = parse(all);
    assert.equal(allBody.total, 6);
    assert.equal(allBody.scopeTotal, 6);
    assert.equal((allBody.data as Json[]).length, 6);

    const filtered = await request(
      'GET',
      '/api/users?page=1&pageSize=50&search=Ana',
      orgAdminToken,
    );
    assert.equal(filtered.statusCode, 200, filtered.body);
    const filteredBody = parse(filtered);
    assert.equal(filteredBody.total, 1);
    assert.equal(filteredBody.scopeTotal, 6);
  });

  it('searches by email, person name, first name, last name and document', async () => {
    const searches = [
      ['ana.lopez', 1],
      ['Ana López', 1],
      ['Bruno', 1],
      ['Díaz', 1],
      ['55555555', 1],
    ] as const;

    for (const [term, expected] of searches) {
      const response = await request(
        'GET',
        `/api/users?page=1&pageSize=50&search=${encodeURIComponent(term)}`,
        orgAdminToken,
      );
      assert.equal(response.statusCode, 200, response.body);
      assert.equal(parse(response).total, expected, `search term: ${term}`);
    }
  });

  it('filters by global account status', async () => {
    const inactive = await request(
      'GET',
      '/api/users?page=1&pageSize=50&status=inactive',
      orgAdminToken,
    );
    assert.equal(inactive.statusCode, 200, inactive.body);
    const inactiveBody = parse(inactive);
    assert.equal(inactiveBody.total, 1);
    assert.equal((inactiveBody.data as Json[])[0].email.includes('carla.ruiz'), true);

    const active = await request(
      'GET',
      '/api/users?page=1&pageSize=50&status=active',
      orgAdminToken,
    );
    assert.equal(active.statusCode, 200, active.body);
    assert.equal(parse(active).total, 5);
  });

  it('combines search and status filters', async () => {
    const response = await request(
      'GET',
      '/api/users?page=1&pageSize=50&search=Carla&status=inactive',
      orgAdminToken,
    );
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(parse(response).total, 1);
  });

  it('limits community admins to their community and keeps the scoped total', async () => {
    const all = await request('GET', '/api/users?page=1&pageSize=50', communityAdminToken);
    assert.equal(all.statusCode, 200, all.body);
    const body = parse(all);
    assert.equal(body.scopeTotal, 4);
    assert.equal(body.total, 4);

    const search = await request(
      'GET',
      '/api/users?page=1&pageSize=50&search=Ana',
      communityAdminToken,
    );
    assert.equal(search.statusCode, 200, search.body);
    const searchBody = parse(search);
    assert.equal(searchBody.total, 1);
    assert.equal(searchBody.scopeTotal, 4);

    const otherCommunity = await request(
      'GET',
      `/api/users?page=1&pageSize=50&search=Carla`,
      communityAdminToken,
    );
    assert.equal(otherCommunity.statusCode, 200, otherCommunity.body);
    assert.equal(parse(otherCommunity).total, 0);
  });

  it('returns community names and one membership row per community', async () => {
    const response = await request(
      'GET',
      '/api/users?page=1&pageSize=50&search=multi',
      orgAdminToken,
    );
    assert.equal(response.statusCode, 200, response.body);
    const user = (parse(response).data as Json[])[0];
    assert.equal(user.memberships.length, 2);
    const names = (user.memberships as Json[]).map((membership) => membership.communityName);
    assert.deepEqual(names.sort(), [communityAName, communityBName].sort());
  });

  it('exposes the account id and resolves memberships by person', async () => {
    const response = await request('GET', `/api/users/${multiAccountId}`, orgAdminToken);
    assert.equal(response.statusCode, 200, response.body);
    const user = parse(response);
    assert.equal(user.id, multiAccountId);
    assert.equal(user.accountId, multiAccountId);
    assert.ok(user.personId);
    assert.equal(user.memberships.length, 2);
    const names = (user.memberships as Json[]).map((membership) => membership.communityName);
    assert.deepEqual(names.sort(), [communityAName, communityBName].sort());
  });

  it('returns 404 for an unknown account id', async () => {
    const response = await request('GET', `/api/users/${randomUUID()}`, orgAdminToken);
    assert.equal(response.statusCode, 404);
  });

  it('toggles the global account status through PATCH /api/users/:id by account id', async () => {
    const response = await request('PATCH', `/api/users/${orgAdminAccountId}`, orgAdminToken, {
      active: false,
    });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(parse(response).active, false);

    await request('PATCH', `/api/users/${orgAdminAccountId}`, orgAdminToken, { active: true });
  });

  it('updates the person profile through PATCH /api/users/:id', async () => {
    const response = await request('PATCH', `/api/users/${anaAccountId}`, orgAdminToken, {
      name: 'Ana María López',
    });
    assert.equal(response.statusCode, 200, response.body);
    const user = parse(response);
    assert.equal(user.id, anaAccountId);
    assert.equal(user.name, 'Ana María López');
    assert.equal(user.personName, 'Ana María López');

    const search = await request(
      'GET',
      '/api/users?page=1&pageSize=50&search=María',
      orgAdminToken,
    );
    assert.equal(search.statusCode, 200, search.body);
    assert.equal(parse(search).total, 1);
  });

  it('creates a user without password and returns the activation link once', async () => {
    activationEmail = `activation-${randomUUID().slice(0, 8)}@test.local`;
    createdEmails.push(activationEmail);

    const response = await request(
      'POST',
      '/api/users',
      orgAdminToken,
      {
        email: activationEmail,
        firstName: 'Activo',
        lastName: 'Prueba',
        role: 'staff',
        communityId: communityAId,
        // El servidor ignora cualquier contraseña enviada por el administrador.
        password: 'ignored-password-123',
      },
    );
    assert.equal(response.statusCode, 201, response.body);
    const body = parse(response);
    activationAccountId = body.id;
    assert.equal(body.email, activationEmail);
    assert.equal(body.emailSent, false);
    assert.equal(body.pendingActivation, true);
    assert.equal('passwordHash' in body, false);
    assert.equal(typeof body.activationUrl, 'string');
    assert.match(body.activationUrl, /motivo=activacion/);

    const url = new URL(body.activationUrl);
    activationToken = url.searchParams.get('token') ?? '';
    assert.ok(activationToken);
  });

  it('rejects login before the account is activated', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: activationEmail, password: 'cualquier-clave-123' },
    });
    assert.equal(response.statusCode, 401, response.body);
  });

  it('completes the activation and allows login with the chosen password', async () => {
    const reset = await app.inject({
      method: 'POST',
      url: '/api/auth/password/reset',
      payload: { token: activationToken, password: 'activada-123456' },
    });
    assert.equal(reset.statusCode, 200, reset.body);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: activationEmail, password: 'activada-123456' },
    });
    assert.equal(login.statusCode, 200, login.body);

    const [account] = await db
      .select({ activatedAt: accounts.activatedAt })
      .from(accounts)
      .where(eq(accounts.id, activationAccountId));
    assert.ok(account.activatedAt);
  });

  it('rejects a resend for an account that already chose its password', async () => {
    const response = await request(
      'POST',
      `/api/users/${activationAccountId}/activation`,
      orgAdminToken,
    );
    assert.equal(response.statusCode, 409, response.body);
    assert.equal(parse(response).code, 'already_active');
  });

  it('resends activation and invalidates the previous link', async () => {
    const email = `resend-${randomUUID().slice(0, 8)}@test.local`;
    createdEmails.push(email);

    const created = await request(
      'POST',
      '/api/users',
      orgAdminToken,
      { email, firstName: 'Reenvío', role: 'staff', communityId: communityAId },
    );
    assert.equal(created.statusCode, 201, created.body);
    const createdBody = parse(created);
    const firstToken = new URL(createdBody.activationUrl).searchParams.get('token') ?? '';
    assert.ok(firstToken);

    const resent = await request(
      'POST',
      `/api/users/${createdBody.id}/activation`,
      orgAdminToken,
    );
    assert.equal(resent.statusCode, 200, resent.body);
    const resentBody = parse(resent);
    assert.equal(resentBody.emailSent, false);
    const secondToken = new URL(resentBody.activationUrl).searchParams.get('token') ?? '';
    assert.ok(secondToken);
    assert.notEqual(secondToken, firstToken);

    const oldLink = await app.inject({
      method: 'POST',
      url: '/api/auth/password/reset',
      payload: { token: firstToken, password: 'clave-1234567' },
    });
    assert.equal(oldLink.statusCode, 400, oldLink.body);

    const newLink = await app.inject({
      method: 'POST',
      url: '/api/auth/password/reset',
      payload: { token: secondToken, password: 'clave-1234567' },
    });
    assert.equal(newLink.statusCode, 200, newLink.body);
  });

  it('forbids a community admin from resending outside their community', async () => {
    const response = await request(
      'POST',
      `/api/users/${carlaAccountId}/activation`,
      communityAdminToken,
    );
    assert.equal(response.statusCode, 403, response.body);
  });
});
