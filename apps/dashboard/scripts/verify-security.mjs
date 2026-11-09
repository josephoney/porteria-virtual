import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const API = process.env.API_URL ?? 'http://127.0.0.1:3000';
const SIGNALING = process.env.SIGNALING_URL ?? 'http://127.0.0.1:3001';
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? 'dev-internal-key-change-me';
const KIOSK_TOKEN = process.env.KIOSK_DEVICE_TOKEN ?? 'dev-kiosk-token';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, { method = 'GET', token, body, headers } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // keep raw text
  }
  return { status: response.status, data };
}

async function login(email, password = 'porteria123') {
  const result = await request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(result.status, 200, `login ${email}: expected 200, got ${result.status}`);

  if (result.data.requiresContextSelection) {
    assert.ok(result.data.memberships?.length, `login ${email}: no memberships to select`);
    const context = await request('/api/auth/context', {
      method: 'POST',
      token: result.data.selectionToken,
      body: { membershipId: result.data.memberships[0].id },
    });
    assert.equal(context.status, 200, `context ${email}: expected 200, got ${context.status}`);
    return context.data.accessToken;
  }

  return result.data.accessToken;
}

function once(socket, event, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), timeout);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function connect(auth) {
  return io(SIGNALING, { transports: ['websocket'], auth, reconnection: false });
}

async function expectSocketRejected(auth, label) {
  const socket = connect(auth);
  try {
    await once(socket, 'connect_error');
  } finally {
    socket.close();
  }
  console.log(`OK socket rejected: ${label}`);
}

async function main() {
  const platformToken = await login('superadmin@porteria.local');
  const orgAdminToken = await login('admin@porteria.local');
  const communityAdminToken = await login('communityadmin@porteria.local');
  const operatorToken = await login('operador@porteria.local');
  const residentToken = await login('residente@porteria.local');
  const guardToken = await login('guardia@porteria.local');
  const org2Token = await login('admin2@porteria.local');

  const tenantAsPlatform = await request('/api/communities', { token: platformToken });
  assert.equal(tenantAsPlatform.status, 403, 'platform admin must not read tenant communities');
  console.log('OK platform context: tenant endpoint returns 403');

  const platformUsers = await request('/api/platform/users', { token: platformToken });
  assert.equal(platformUsers.status, 200, 'platform admin must read global users');
  console.log('OK platform context: global users endpoint returns 200');

  const orgAdminPlatform = await request('/api/platform/organizations', {
    token: orgAdminToken,
  });
  assert.equal(orgAdminPlatform.status, 403, 'org_admin must not read platform organizations');
  const communityAdminPlatform = await request('/api/platform/users', {
    token: communityAdminToken,
  });
  assert.equal(communityAdminPlatform.status, 403, 'community_admin must not read platform users');
  const guardPlatform = await request('/api/platform/users', { token: guardToken });
  assert.equal(guardPlatform.status, 403, 'guard must not read platform users');
  console.log('OK tenant -> platform access is 403');

  const guardEvents = await request('/api/events?page=1&pageSize=1', {
    token: guardToken,
  });
  assert.equal(guardEvents.status, 200, 'guard must read events for Bitácora');
  const guardReports = await request('/api/reports/daily', { token: guardToken });
  assert.equal(guardReports.status, 200, 'guard must read reports');
  const residentEvents = await request('/api/events?page=1&pageSize=1', {
    token: residentToken,
  });
  assert.equal(residentEvents.status, 403, 'resident must not read events');
  console.log('OK analysis access: guard events/reports, resident rejected');

  const communityCommunities = await request('/api/communities', {
    token: communityAdminToken,
  });
  assert.equal(communityCommunities.status, 200, 'community_admin must list own communities');
  assert.ok(communityCommunities.data.length >= 1, 'community_admin has no community');
  const ownCommunity = communityCommunities.data[0];
  const ownSections = await request(
    `/api/communities/${ownCommunity.id}/buildings`,
    { token: communityAdminToken },
  );
  assert.equal(ownSections.status, 200, 'community_admin must read own sections');
  const org2Communities = await request('/api/communities', { token: org2Token });
  assert.ok(org2Communities.data.length >= 1, 'org2 has no community');
  const foreignSections = await request(
    `/api/communities/${org2Communities.data[0].id}/buildings`,
    { token: communityAdminToken },
  );
  assert.equal(
    foreignSections.status,
    404,
    'community_admin must not read another tenant sections',
  );
  console.log('OK tenant scope: own sections allowed, foreign sections rejected');

  const escalation = await request('/api/users', {
    method: 'POST',
    token: communityAdminToken,
    body: {
      email: `verify-escalation-${Date.now()}@example.com`,
      password: 'test12345',
      name: 'Verify Escalation',
      role: 'org_admin',
    },
  });
  assert.equal(escalation.status, 403, 'community_admin must not create org_admin');
  console.log('OK role guardrail: community_admin -> org_admin returns 403');

  const resolve = await fetch(`${API}/api/internal/kiosks/resolve?rpiId=edificio-01`, {
    headers: { 'X-Internal-Key': INTERNAL_KEY },
  });
  assert.equal(resolve.status, 200, 'resolve must return the demo kiosk');
  const resolved = await resolve.json();
  assert.equal(resolved.rpiId, 'edificio-01', 'resolve must return the expected rpiId');
  assert.ok(resolved.communityId, 'resolve must include communityId');
  console.log(`OK kiosk identity: edificio-01 resolves to ${resolved.kioskId}`);

  await expectSocketRejected({}, 'anonymous');
  await expectSocketRejected({ token: residentToken }, 'resident');
  await expectSocketRejected({ token: platformToken }, 'platform admin');

  const kiosk = connect({ deviceToken: KIOSK_TOKEN });
  await once(kiosk, 'connect');
  kiosk.emit('kiosk:register', { name: 'Verify Kiosk' });
  const registered = await once(kiosk, 'kiosk:registered');
  assert.ok(registered.kioskId, 'kiosk:registered must include kioskId');
  console.log(`OK kiosk auth: registered ${registered.kioskId}`);

  let kioskReceivedDoor = false;
  kiosk.on('door:open', () => {
    kioskReceivedDoor = true;
  });

  const operator = connect({ token: operatorToken });
  await once(operator, 'connect');
  operator.emit('operator:register', { name: 'Verify Operator' });
  const operatorState = await once(operator, 'operator:registered');
  assert.ok(operatorState.kiosks.length >= 1, 'operator must see the registered kiosk');
  console.log(`OK operator scope: sees ${operatorState.kiosks.length} kiosk(s)`);

  const org2 = connect({ token: org2Token });
  await once(org2, 'connect');
  org2.emit('operator:register', { name: 'Verify Org2' });
  const org2State = await once(org2, 'operator:registered');
  assert.equal(org2State.kiosks.length, 0, 'org2 must not see another tenant kiosk');
  console.log('OK tenant isolation: org2 sees 0 kiosks');

  const org2Error = once(org2, 'error');
  org2.emit('door:open', { callId: 'verify', kioskId: registered.kioskId });
  await org2Error;
  await wait(500);
  assert.equal(kioskReceivedDoor, false, 'cross-community door:open must not reach the kiosk');
  console.log('OK actuation isolation: cross-community door:open rejected');
  org2.close();

  const incoming = await (async () => {
    const pending = once(operator, 'call:incoming');
    kiosk.emit('call:request');
    return pending;
  })();
  const accepted = once(kiosk, 'call:accepted');
  const ready = once(operator, 'call:ready');
  operator.emit('call:accept', {
    callId: incoming.callId,
    kioskId: incoming.kioskId,
  });
  await Promise.all([accepted, ready]);
  console.log(`OK call flow: accepted ${incoming.callId}`);

  kiosk.emit('call:end', { callId: incoming.callId });
  await wait(800);

  const orgCalls = await request('/api/calls', { token: orgAdminToken });
  assert.ok(orgCalls.data.total >= 1, 'org_admin must see the call');
  const communityCalls = await request('/api/calls', { token: communityAdminToken });
  assert.ok(communityCalls.data.total >= 1, 'community_admin must see community calls');
  const operatorCalls = await request('/api/calls', { token: operatorToken });
  assert.ok(operatorCalls.data.total >= 1, 'operator must see their own call');
  console.log(
    `OK call scope: org_admin=${orgCalls.data.total}, community_admin=${communityCalls.data.total}, operator=${operatorCalls.data.total}`,
  );

  kiosk.close();
  operator.close();
  console.log('All security verification checks passed.');
}

main().catch((error) => {
  console.error('Security verification failed:', error);
  process.exit(1);
});
