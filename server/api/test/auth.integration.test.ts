import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.DYNAMIC_QR_ENABLED = 'false';
process.env.NODE_ENV = 'test';

import { createDb } from '@porteria/database';
import {
  accounts,
  communities,
  memberships,
  organizations,
  people,
} from '@porteria/database/schema';
import { hashPassword } from '../src/services/credentials.service.js';

const db = createDb();

const CURRENT_PASSWORD = 'contrasena-actual-123';
const NEW_PASSWORD = 'contrasena-nueva-456';

let app: FastifyInstance;
let organizationId: string;
let communityId: string;
let personId: string;
let accountId: string;
let membershipId: string;
let email: string;
let seedHash: string;

type Json = Record<string, any>;

function parse(response: { body: string }): Json {
  return JSON.parse(response.body) as Json;
}

async function login(password: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password },
  });
}

async function refresh(refreshToken: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/refresh',
    payload: { refreshToken },
  });
}

async function logout(refreshToken: string) {
  return app.inject({
    method: 'POST',
    url: '/api/auth/logout',
    payload: { refreshToken },
  });
}

async function changePassword(accessToken: string, currentPassword: string, newPassword: string) {
  return app.inject({
    method: 'PATCH',
    url: '/api/me/password',
    headers: { authorization: `Bearer ${accessToken}` },
    payload: { currentPassword, newPassword },
  });
}

describe('auth sessions sobre accounts', () => {
  before(async () => {
    const suffix = randomUUID().slice(0, 8);
    email = `auth-account-${suffix}@test.local`;

    const [organization] = await db
      .insert(organizations)
      .values({ name: `Auth Test Org ${suffix}`, slug: `auth-test-org-${suffix}` })
      .returning();
    organizationId = organization.id;

    const [community] = await db
      .insert(communities)
      .values({
        organizationId,
        name: `Comunidad Auth ${suffix}`,
        slug: `auth-test-community-${suffix}`,
        address: 'Calle Auth 123',
        timezone: 'UTC',
      })
      .returning();
    communityId = community.id;

    const [person] = await db
      .insert(people)
      .values({
        firstName: 'Ada',
        lastName: 'Autenticada',
        documentType: 'CC',
        documentNumber: `77${suffix}`,
      })
      .returning();
    personId = person.id;

    const passwordHash = await hashPassword(CURRENT_PASSWORD);
    seedHash = passwordHash;

    const [account] = await db
      .insert(accounts)
      .values({ personId, email, passwordHash, active: true })
      .returning();
    accountId = account.id;

    const [membership] = await db
      .insert(memberships)
      .values({
        personId,
        organizationId,
        communityId,
        role: 'org_admin',
        status: 'active',
      })
      .returning();
    membershipId = membership.id;

    const { buildApp } = await import('../src/index.js');
    app = (await buildApp()).app;
  });

  after(async () => {
    await app?.close();
    await db.delete(memberships).where(eq(memberships.id, membershipId));
    await db.delete(accounts).where(eq(accounts.id, accountId));
    await db.delete(people).where(eq(people.id, personId));
    await db.delete(communities).where(eq(communities.id, communityId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  });

  it('inicia sesión con email y contraseña de la cuenta', async () => {
    const response = await login(CURRENT_PASSWORD);
    assert.equal(response.statusCode, 200);

    const body = parse(response);
    assert.ok(body.accessToken);
    assert.ok(body.refreshToken);
    assert.equal(body.user.email, email);
    assert.equal(body.user.name, 'Ada Autenticada');
    assert.equal(body.user.id, accountId);
    assert.equal(body.activeMembership.id, membershipId);

    // La identidad vive solo en people + accounts: el login no crea una fila
    // en la tabla legada.
    const accountRows = await db
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.id, accountId));
    const personRows = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.id, personId));
    assert.equal(accountRows.length, 1);
    assert.equal(personRows.length, 1);
  });

  it('firma el access token con el id de la cuenta en sub', async () => {
    const body = parse(await login(CURRENT_PASSWORD));
    const payload = app.jwt.verify<{ sub: string; accountId?: string; personId?: string }>(
      body.accessToken,
    );

    assert.equal(payload.sub, accountId);
    assert.equal(payload.accountId, accountId);
    assert.equal(payload.personId, personId);
  });

  it('resuelve el usuario autenticado a partir de la cuenta', async () => {
    const session = parse(await login(CURRENT_PASSWORD));
    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${session.accessToken}` },
    });

    assert.equal(response.statusCode, 200);
    const body = parse(response);
    assert.equal(body.id, accountId);
    assert.equal(body.email, email);
  });

  it('rechaza un token previo cuyo sub es un users.id', async () => {
    const legacyToken = app.jwt.sign({
      sub: randomUUID(),
      accountId,
      personId,
      email,
      orgId: organizationId,
      membershipId,
      role: 'org_admin',
      communityId,
      unitId: null,
      isPlatformAdmin: false,
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      headers: { authorization: `Bearer ${legacyToken}` },
    });

    assert.equal(response.statusCode, 401);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const response = await login('no-es-la-contrasena');
    assert.equal(response.statusCode, 401);
  });

  it('renueva tokens y consume el refresh anterior', async () => {
    const first = parse(await login(CURRENT_PASSWORD));
    const renewed = await refresh(first.refreshToken);
    assert.equal(renewed.statusCode, 200);

    const body = parse(renewed);
    assert.ok(body.accessToken);
    assert.notEqual(body.refreshToken, first.refreshToken);

    const replay = await refresh(first.refreshToken);
    assert.equal(replay.statusCode, 401);
  });

  it('revoca el refresh al cerrar sesión', async () => {
    const session = parse(await login(CURRENT_PASSWORD));

    const closed = await logout(session.refreshToken);
    assert.equal(closed.statusCode, 200);

    const afterLogout = await refresh(session.refreshToken);
    assert.equal(afterLogout.statusCode, 401);
  });

  it('rechaza el cambio de contraseña si la actual no coincide', async () => {
    const session = parse(await login(CURRENT_PASSWORD));

    const response = await changePassword(session.accessToken, 'otra-cosa', NEW_PASSWORD);
    assert.equal(response.statusCode, 401);
  });

  it('cambia la contraseña y revoca las sesiones abiertas', async () => {
    const session = parse(await login(CURRENT_PASSWORD));

    const response = await changePassword(session.accessToken, CURRENT_PASSWORD, NEW_PASSWORD);
    assert.equal(response.statusCode, 200);

    const stillValid = await refresh(session.refreshToken);
    assert.equal(stillValid.statusCode, 401);

    const withOld = await login(CURRENT_PASSWORD);
    assert.equal(withOld.statusCode, 401);

    const withNew = await login(NEW_PASSWORD);
    assert.equal(withNew.statusCode, 200);
    assert.ok(parse(withNew).accessToken);
  });

  it('guarda la contraseña sólo en accounts', async () => {
    const [account] = await db
      .select({ passwordHash: accounts.passwordHash })
      .from(accounts)
      .where(eq(accounts.id, accountId));

    assert.notEqual(account.passwordHash, seedHash);
  });
});
