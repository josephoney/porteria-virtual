import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.DYNAMIC_QR_ENABLED = 'false';
process.env.NODE_ENV = 'test';

import { createDb } from '@porteria/database';
import {
  accounts,
  invitations,
  memberships,
  organizations,
  people,
  users,
} from '@porteria/database/schema';

const db = createDb();

let app: FastifyInstance;
let suffix: string;
let platformToken: string;
let orgAdminToken: string;
let communityAdminToken: string;
let organizationId: string;
let communityId: string;
let orgAdminAccountId: string;
let orgAdminPersonId: string;
let orgAdminMembershipId: string;
let firstAdministratorEmail: string;
const createdEmails: string[] = [];
const userIds: string[] = [];
const personIds: string[] = [];

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
  key: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  documentNumber: string;
  role: string;
  organizationId: string | null;
  communityId: string | null;
  isPlatformAdmin?: boolean;
}) {
  const [user] = await db
    .insert(users)
    .values({
      email: input.email,
      passwordHash: 'x',
      name: input.name,
      isPlatformAdmin: input.isPlatformAdmin ?? false,
    })
    .returning();
  userIds.push(user.id);
  createdEmails.push(input.email);

  const [person] = await db
    .insert(people)
    .values({
      firstName: input.firstName,
      lastName: input.lastName,
      documentType: 'CC',
      documentNumber: input.documentNumber,
      contactEmail: input.email,
      status: 'active',
    })
    .returning();
  personIds.push(person.id);

  const [account] = await db
    .insert(accounts)
    .values({ personId: person.id, email: input.email, passwordHash: 'x' })
    .returning();

  const [membership] = input.organizationId
    ? await db
        .insert(memberships)
        .values({
          userId: user.id,
          personId: person.id,
          organizationId: input.organizationId,
          communityId: input.communityId,
          role: input.role as (typeof memberships.$inferInsert)['role'],
          status: 'active',
        })
        .returning()
    : [];

  return { user, person, account, membership };
}

async function activeOrgAdmins(organization: string) {
  return db
    .select({ id: memberships.id, personId: memberships.personId })
    .from(memberships)
    .where(
      and(
        eq(memberships.organizationId, organization),
        eq(memberships.role, 'org_admin'),
        eq(memberships.status, 'active'),
      ),
    );
}

describe('organization profile geography and administrator transfer', () => {
  before(async () => {
    suffix = randomUUID().slice(0, 8);
    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;

    const platformAdmin = await createUserFixture({
      key: 'platform',
      email: `profile-platform-${suffix}@test.local`,
      name: 'Platform Admin',
      firstName: 'Pia',
      lastName: 'Plataforma',
      documentNumber: `80${suffix}`,
      role: 'org_admin',
      organizationId: null,
      communityId: null,
      isPlatformAdmin: true,
    });
    platformToken = app.jwt.sign({
      sub: platformAdmin.account.id,
      email: platformAdmin.user.email,
      accountId: platformAdmin.account.id,
      personId: platformAdmin.person.id,
      orgId: randomUUID(),
      membershipId: 'platform',
      role: 'org_admin',
      communityId: null,
      unitId: null,
      isPlatformAdmin: true,
    });

    // 6.1 - organization created through the platform API with geography.
    const createdOrganization = await request(
      'POST',
      '/api/platform/organizations',
      platformToken,
      {
        name: `Profile Test Org ${suffix}`,
        municipality: 'MedellÃ­n',
        department: 'Antioquia',
        country: 'Colombia',
      },
    );
    assert.equal(createdOrganization.statusCode, 201);
    const organizationBody = parse(createdOrganization);
    organizationId = organizationBody.id;
    assert.equal(organizationBody.municipality, 'MedellÃ­n');
    assert.equal(organizationBody.department, 'Antioquia');
    assert.equal(organizationBody.country, 'Colombia');

    firstAdministratorEmail = `profile-org-admin-${suffix}@test.local`;
    const orgAdmin = await createUserFixture({
      key: 'org-admin',
      email: firstAdministratorEmail,
      name: 'Org Admin',
      firstName: 'Olga',
      lastName: 'Administradora',
      documentNumber: `81${suffix}`,
      role: 'org_admin',
      organizationId,
      communityId: null,
    });
    orgAdminAccountId = orgAdmin.account.id;
    orgAdminPersonId = orgAdmin.person.id;
    orgAdminMembershipId = orgAdmin.membership.id;
    orgAdminToken = app.jwt.sign({
      sub: orgAdmin.account.id,
      email: orgAdmin.user.email,
      accountId: orgAdmin.account.id,
      personId: orgAdmin.person.id,
      orgId: organizationId,
      membershipId: orgAdmin.membership.id,
      role: 'org_admin',
      communityId: null,
      unitId: null,
      isPlatformAdmin: false,
    });

    // 6.1 - community created by the org admin with geography.
    const createdCommunity = await request(
      'POST',
      '/api/organizations/me/communities',
      orgAdminToken,
      {
        name: `Comunidad Perfil ${suffix}`,
        address: 'Calle 10 #20-30',
        timezone: 'America/Bogota',
        municipality: 'Envigado',
        department: 'Antioquia',
        country: 'Colombia',
      },
    );
    assert.equal(createdCommunity.statusCode, 201);
    const communityBody = parse(createdCommunity);
    communityId = communityBody.id;
    assert.equal(communityBody.municipality, 'Envigado');
    assert.equal(communityBody.department, 'Antioquia');
    assert.equal(communityBody.country, 'Colombia');

    const communityAdmin = await createUserFixture({
      key: 'community-admin',
      email: `profile-community-admin-${suffix}@test.local`,
      name: 'Community Admin',
      firstName: 'Camilo',
      lastName: 'Administrador',
      documentNumber: `82${suffix}`,
      role: 'community_admin',
      organizationId,
      communityId,
    });
    communityAdminToken = app.jwt.sign({
      sub: communityAdmin.account.id,
      email: communityAdmin.user.email,
      accountId: communityAdmin.account.id,
      personId: communityAdmin.person.id,
      orgId: organizationId,
      membershipId: communityAdmin.membership.id,
      role: 'community_admin',
      communityId,
      unitId: null,
      isPlatformAdmin: false,
    });
  });

  after(async () => {
    if (organizationId) {
      await db.delete(memberships).where(eq(memberships.organizationId, organizationId));
      await db.delete(invitations).where(eq(invitations.organizationId, organizationId));
    }
    if (createdEmails.length > 0) {
      await db.delete(users).where(inArray(users.email, createdEmails));
      await db.delete(people).where(inArray(people.contactEmail, createdEmails));
    }
    if (userIds.length > 0) await db.delete(users).where(inArray(users.id, userIds));
    if (personIds.length > 0) await db.delete(people).where(inArray(people.id, personIds));
    if (organizationId) await db.delete(organizations).where(eq(organizations.id, organizationId));
    await app.close();
  });

  it('reads back the geography of the organization and the community', async () => {
    const organizationResponse = await request('GET', '/api/organizations/me', orgAdminToken);
    assert.equal(organizationResponse.statusCode, 200);
    const organization = parse(organizationResponse);
    assert.equal(organization.municipality, 'MedellÃ­n');
    assert.equal(organization.department, 'Antioquia');
    assert.equal(organization.country, 'Colombia');

    const overviewResponse = await request(
      'GET',
      `/api/communities/${communityId}/overview`,
      orgAdminToken,
    );
    assert.equal(overviewResponse.statusCode, 200);
    const overview = parse(overviewResponse);
    assert.equal(overview.community.municipality, 'Envigado');
    assert.equal(overview.community.department, 'Antioquia');
    assert.equal(overview.community.country, 'Colombia');
  });

  it('clears the geography with null and rejects values longer than 120 characters', async () => {
    const clearOrganization = await request('PATCH', '/api/organizations/me', orgAdminToken, {
      municipality: null,
      department: null,
      country: null,
    });
    assert.equal(clearOrganization.statusCode, 200);
    const clearedOrganization = parse(clearOrganization);
    assert.equal(clearedOrganization.municipality, null);
    assert.equal(clearedOrganization.department, null);
    assert.equal(clearedOrganization.country, null);

    const tooLong = 'a'.repeat(121);
    const invalidOrganization = await request('PATCH', '/api/organizations/me', orgAdminToken, {
      municipality: tooLong,
    });
    assert.equal(invalidOrganization.statusCode, 400);

    const restore = await request('PATCH', '/api/organizations/me', orgAdminToken, {
      municipality: 'MedellÃ­n',
      department: 'Antioquia',
      country: 'Colombia',
    });
    assert.equal(restore.statusCode, 200);

    const clearCommunity = await request(
      'PATCH',
      `/api/communities/${communityId}`,
      orgAdminToken,
      {
        municipality: null,
        department: null,
        country: null,
      },
    );
    assert.equal(clearCommunity.statusCode, 200);
    const clearedCommunity = parse(clearCommunity);
    assert.equal(clearedCommunity.municipality, null);
    assert.equal(clearedCommunity.department, null);
    assert.equal(clearedCommunity.country, null);

    const invalidCommunity = await request(
      'PATCH',
      `/api/communities/${communityId}`,
      orgAdminToken,
      {
        country: tooLong,
      },
    );
    assert.equal(invalidCommunity.statusCode, 400);

    const restoreCommunity = await request(
      'PATCH',
      `/api/communities/${communityId}`,
      orgAdminToken,
      { municipality: 'Envigado', department: 'Antioquia', country: 'Colombia' },
    );
    assert.equal(restoreCommunity.statusCode, 200);
  });

  it('rejects tenant administrators on the platform organization endpoint', async () => {
    const asOrgAdmin = await request(
      'PATCH',
      `/api/platform/organizations/${organizationId}`,
      orgAdminToken,
      { name: `Should Fail ${suffix}` },
    );
    assert.equal(asOrgAdmin.statusCode, 403);

    const asCommunityAdmin = await request(
      'PATCH',
      `/api/platform/organizations/${organizationId}`,
      communityAdminToken,
      { name: `Should Fail ${suffix}` },
    );
    assert.equal(asCommunityAdmin.statusCode, 403);
  });

  it('keeps the same administrator when the email matches the current one', async () => {
    const response = await request(
      'PATCH',
      `/api/platform/organizations/${organizationId}`,
      platformToken,
      { administratorEmail: firstAdministratorEmail },
    );
    assert.equal(response.statusCode, 200);
    const body = parse(response);
    assert.equal(body.administrator.status, 'active');
    assert.equal(body.administrator.userId, orgAdminAccountId);
    assert.equal(body.administrator.email, firstAdministratorEmail);

    const admins = await activeOrgAdmins(organizationId);
    assert.equal(admins.length, 1);
    assert.equal(admins[0].personId, orgAdminPersonId);
  });

  it('transfers the administration immediately when the email already has an account', async () => {
    const replacementEmail = `profile-replacement-${suffix}@test.local`;
    const replacement = await createUserFixture({
      key: 'replacement',
      email: replacementEmail,
      name: 'Nuevo Admin',
      firstName: 'Nora',
      lastName: 'Nueva',
      documentNumber: `83${suffix}`,
      role: 'resident',
      organizationId,
      communityId,
    });

    const response = await request(
      'PATCH',
      `/api/platform/organizations/${organizationId}`,
      platformToken,
      { administratorEmail: replacementEmail },
    );
    assert.equal(response.statusCode, 200);
    const body = parse(response);
    assert.equal(body.administrator.status, 'active');
    assert.equal(body.administrator.userId, replacement.account.id);
    assert.equal(body.administrator.email, replacementEmail);

    const admins = await activeOrgAdmins(organizationId);
    assert.equal(admins.length, 1);
    assert.equal(admins[0].personId, replacement.person.id);

    const [previous] = await db
      .select({ status: memberships.status })
      .from(memberships)
      .where(eq(memberships.id, orgAdminMembershipId))
      .limit(1);
    assert.equal(previous.status, 'inactive');
  });

  it('invites a new administrator and leaves only one active after acceptance', async () => {
    const invitedEmail = `profile-invited-${suffix}@test.local`;

    const response = await request(
      'PATCH',
      `/api/platform/organizations/${organizationId}`,
      platformToken,
      { administratorEmail: invitedEmail },
    );
    assert.equal(response.statusCode, 200);
    const body = parse(response);
    assert.equal(body.administrator.status, 'pending');
    assert.equal(body.administrator.email, invitedEmail);
    assert.ok(body.administrator.acceptUrl.includes('/invite/'));

    // The current administrator stays active until the invitation is accepted.
    const beforeAcceptance = await activeOrgAdmins(organizationId);
    assert.equal(beforeAcceptance.length, 1);
    assert.notEqual(beforeAcceptance[0].personId, orgAdminPersonId);

    const token = body.administrator.acceptUrl.split('/invite/')[1];
    const accepted = await app.inject({
      method: 'POST',
      url: `/api/public/invitations/${token}/accept`,
      payload: { name: 'Invitada Admin', password: 'porteria123' },
    });
    assert.equal(accepted.statusCode, 200);
    createdEmails.push(invitedEmail);

    const [invitedAccount] = await db
      .select({ personId: accounts.personId })
      .from(accounts)
      .where(eq(accounts.email, invitedEmail))
      .limit(1);
    assert.ok(invitedAccount);

    const afterAcceptance = await activeOrgAdmins(organizationId);
    assert.equal(afterAcceptance.length, 1);
    assert.equal(afterAcceptance[0].personId, invitedAccount.personId);

    const [pending] = await db
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, organizationId),
          eq(invitations.role, 'org_admin'),
          eq(invitations.status, 'pending'),
        ),
      );
    assert.equal(pending, undefined);
  });

  it('returns 404 when the organization does not exist', async () => {
    const response = await request(
      'PATCH',
      `/api/platform/organizations/${randomUUID()}`,
      platformToken,
      { name: `Missing ${suffix}` },
    );
    assert.equal(response.statusCode, 404);
  });
});
