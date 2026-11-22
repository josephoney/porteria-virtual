import { and, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  accounts,
  memberships,
  refreshTokens,
  communities,
  people,
} from '@porteria/database/schema';
import type {
  AuthUserSummary,
  LoginResponse,
  MembershipSummary,
  RefreshResponse,
} from '@porteria/shared';
import { verifyPassword } from './credentials.service.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from '../config.js';

const db = createDb();

const PLATFORM_MEMBERSHIP_ID = 'platform';

export interface JwtContextPayload {
  sub: string;
  accountId?: string;
  personId?: string;
  email: string;
  orgId: string;
  membershipId: string;
  role: string;
  communityId: string | null;
  unitId: string | null;
  isPlatformAdmin: boolean;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserSummary;
  activeMembership: MembershipSummary;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(membershipId: string): string {
  return `${membershipId}.${crypto.randomBytes(64).toString('hex')}`;
}

function parseRefreshToken(token: string): { membershipId: string; raw: string } | null {
  const idx = token.indexOf('.');
  if (idx <= 0 || idx === token.length - 1) return null;
  return { membershipId: token.slice(0, idx), raw: token };
}

function signAccessToken(payload: JwtContextPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

/**
 * Identidad autenticada resuelta desde `accounts` + `people`. El id expuesto es
 * el de la cuenta: `users` ya no participa en la sesión.
 */
interface AuthAccount {
  /** Id público de la identidad (la cuenta). */
  id: string;
  accountId: string;
  personId: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  active: boolean;
}

function toAuthUser(user: AuthAccount, isPlatformAdmin = user.isPlatformAdmin): AuthUserSummary {
  return {
    id: user.accountId,
    email: user.email,
    name: user.name,
    isPlatformAdmin,
  };
}

function toMembershipSummary(membership: typeof memberships.$inferSelect): MembershipSummary {
  return {
    id: membership.id,
    role: membership.role,
    organizationId: membership.organizationId,
    communityId: membership.communityId,
    unitId: membership.unitId,
    locationUnitId: membership.locationUnitId,
    defaultAccessPointId: membership.defaultAccessPointId,
  };
}

function platformMembership(): MembershipSummary {
  return {
    id: PLATFORM_MEMBERSHIP_ID,
    role: 'staff',
    organizationId: '',
    communityId: null,
    unitId: null,
    locationUnitId: null,
    defaultAccessPointId: null,
  };
}

async function getActiveMemberships(personId: string): Promise<MembershipSummary[]> {
  const rows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.personId, personId), eq(memberships.status, 'active')));
  return rows.map(toMembershipSummary);
}

interface AccountIdentity {
  accountId?: string;
  personId?: string;
}

function identityForUser(user: AuthAccount): AccountIdentity {
  return { accountId: user.accountId, personId: user.personId };
}

/**
 * Persona dueña de una cuenta. Las membresías cuelgan de `people`, no de
 * `users`, así que todo alta de membresía necesita resolver esto primero.
 */
export async function personIdForEmail(email: string): Promise<string | null> {
  const [account] = await db
    .select({ personId: accounts.personId })
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);
  return account?.personId ?? null;
}

const accountPersonColumns = {
  id: accounts.id,
  personId: accounts.personId,
  email: accounts.email,
  active: accounts.active,
  isPlatformAdmin: accounts.isPlatformAdmin,
  firstName: people.firstName,
  lastName: people.lastName,
};

type AccountPersonRow = {
  id: string;
  personId: string;
  email: string;
  active: boolean;
  isPlatformAdmin: boolean;
  firstName: string;
  lastName: string;
};

function toAuthAccount(row: AccountPersonRow): AuthAccount {
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  return {
    id: row.id,
    accountId: row.id,
    personId: row.personId,
    email: row.email,
    name: name || row.email,
    isPlatformAdmin: row.isPlatformAdmin,
    active: row.active,
  };
}

export async function userForAccount(accountId: string): Promise<AuthAccount | null> {
  const [row] = await db
    .select(accountPersonColumns)
    .from(accounts)
    .innerJoin(people, eq(accounts.personId, people.id))
    .where(eq(accounts.id, accountId))
    .limit(1);
  return row ? toAuthAccount(row) : null;
}

interface AuthenticatedSubject {
  user: AuthAccount;
  identity: AccountIdentity;
  isPlatformAdmin: boolean;
}

async function authenticate(email: string, password: string): Promise<AuthenticatedSubject | null> {
  const [row] = await db
    .select({ ...accountPersonColumns, passwordHash: accounts.passwordHash })
    .from(accounts)
    .innerJoin(people, eq(accounts.personId, people.id))
    .where(eq(accounts.email, email))
    .limit(1);

  if (!row || !row.active) return null;

  const valid = await verifyPassword(password, row.passwordHash);
  if (!valid) return null;

  return {
    user: toAuthAccount(row),
    identity: { accountId: row.id, personId: row.personId },
    isPlatformAdmin: row.isPlatformAdmin,
  };
}

async function isPlatformAdminForUser(user: AuthAccount): Promise<boolean> {
  const [account] = await db
    .select({ active: accounts.active, isPlatformAdmin: accounts.isPlatformAdmin })
    .from(accounts)
    .where(eq(accounts.id, user.accountId))
    .limit(1);
  if (account && !account.active) return false;
  return Boolean(account?.isPlatformAdmin) || user.isPlatformAdmin;
}

async function createTokens(
  user: AuthAccount,
  membership: MembershipSummary,
  identity: AccountIdentity = {},
  isPlatformAdmin = user.isPlatformAdmin,
): Promise<AuthResult> {
  if (!identity.accountId) {
    // No debería ocurrir: todo usuario tiene cuenta desde el split people/accounts.
    // La migración 0025 aborta si quedan usuarios sin cuenta.
    throw new Error('account_required');
  }

  const payload: JwtContextPayload = {
    // `sub` identifica la cuenta: `users` desaparece y la sesión ya no puede
    // depender de su id.
    sub: identity.accountId,
    ...identity,
    email: user.email,
    orgId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
    communityId: membership.communityId,
    unitId: membership.unitId,
    isPlatformAdmin,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = generateRefreshToken(membership.id);

  await db.insert(refreshTokens).values({
    accountId: identity.accountId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + config.jwt.refreshExpiresInMs),
  });

  return {
    accessToken,
    refreshToken,
    user: toAuthUser(user, isPlatformAdmin),
    activeMembership: membership,
  };
}

export async function login(email: string, password: string): Promise<LoginResponse | null> {
  const subject = await authenticate(email, password);
  if (!subject) return null;
  const { user, identity } = subject;
  const accountId = identity.accountId;
  if (!accountId) return null;

  if (subject.isPlatformAdmin) {
    return createTokens(user, platformMembership(), identity, subject.isPlatformAdmin);
  }

  if (!identity.personId) return null;
  const activeMemberships = await getActiveMemberships(identity.personId);
  if (activeMemberships.length === 0) return null;
  if (activeMemberships.length === 1) {
    return createTokens(user, activeMemberships[0], identity, subject.isPlatformAdmin);
  }

  const selectionToken = jwt.sign(
    {
      sub: accountId,
      ...identity,
      email: user.email,
      purpose: 'context_selection',
    },
    config.jwt.secret,
    { expiresIn: '10m' },
  );

  return { requiresContextSelection: true, memberships: activeMemberships, selectionToken };
}

async function resolveMembership(
  personId: string,
  membershipId: string,
): Promise<MembershipSummary | null> {
  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.id, membershipId),
        eq(memberships.personId, personId),
        eq(memberships.status, 'active'),
      ),
    )
    .limit(1);
  return membership ? toMembershipSummary(membership) : null;
}

export async function refreshToken(token: string): Promise<RefreshResponse | null> {
  const parsed = parseRefreshToken(token);
  if (!parsed) return null;

  const tokenHash = hashToken(token);
  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!stored || stored.revoked || new Date(stored.expiresAt) < new Date()) return null;

  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.id, stored.id));

  const user = await userForAccount(stored.accountId);
  if (!user || !user.active) return null;

  const identity = await identityForUser(user);
  let membership: MembershipSummary | null;
  const isPlatformAdmin = await isPlatformAdminForUser(user);
  if (parsed.membershipId === PLATFORM_MEMBERSHIP_ID) {
    if (!isPlatformAdmin) return null;
    membership = platformMembership();
  } else {
    if (!identity.personId) return null;
    membership = await resolveMembership(identity.personId, parsed.membershipId);
  }

  if (!membership) return null;
  return createTokens(user, membership, identity, isPlatformAdmin);
}

export async function switchContext(
  accountId: string,
  membershipId: string,
  currentRefreshToken?: string,
): Promise<AuthResult | null> {
  const user = await userForAccount(accountId);
  if (!user || !user.active) return null;

  const identity = await identityForUser(user);
  const isPlatformAdmin = await isPlatformAdminForUser(user);
  let membership: MembershipSummary | null;
  if (membershipId === PLATFORM_MEMBERSHIP_ID) {
    if (!isPlatformAdmin) return null;
    membership = platformMembership();
  } else {
    if (!identity.personId) return null;
    membership = await resolveMembership(identity.personId, membershipId);
  }

  if (!membership) return null;

  if (currentRefreshToken) {
    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.tokenHash, hashToken(currentRefreshToken)));
  }

  return createTokens(user, membership, identity, isPlatformAdmin);
}

export async function logout(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.tokenHash, tokenHash));
  return true;
}

export async function getUserByRefreshToken(
  token: string,
): Promise<{ userId: string; role: string; organizationId: string; membershipId: string } | null> {
  const parsed = parseRefreshToken(token);
  if (!parsed) return null;

  const tokenHash = hashToken(token);
  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!stored) return null;

  const user = await userForAccount(stored.accountId);
  if (!user) return null;

  if (parsed.membershipId === PLATFORM_MEMBERSHIP_ID) {
    return {
      userId: user.id,
      role: 'staff',
      organizationId: '',
      membershipId: PLATFORM_MEMBERSHIP_ID,
    };
  }

  const identity = await identityForUser(user);
  if (!identity.personId) return null;
  const membership = await resolveMembership(identity.personId, parsed.membershipId);
  if (!membership) return null;

  return {
    userId: user.id,
    role: membership.role,
    organizationId: membership.organizationId,
    membershipId: membership.id,
  };
}
export type ScopedLoginOutcome =
  | { ok: true; result: LoginResponse }
  | {
      ok: false;
      reason: 'invalid_credentials' | 'community_not_found' | 'no_community_access';
    };

export async function loginScoped(
  email: string,
  password: string,
  communitySlug: string,
): Promise<ScopedLoginOutcome> {
  const [community] = await db
    .select({ id: communities.id })
    .from(communities)
    .where(and(eq(communities.slug, communitySlug), eq(communities.status, 'active')))
    .limit(1);

  if (!community) return { ok: false, reason: 'community_not_found' };

  const subject = await authenticate(email, password);
  if (!subject) return { ok: false, reason: 'invalid_credentials' };
  const { user, identity } = subject;
  const accountId = identity.accountId;
  if (!accountId) return { ok: false, reason: 'invalid_credentials' };

  if (subject.isPlatformAdmin) {
    return {
      ok: true,
      result: await createTokens(user, platformMembership(), identity, true),
    };
  }

  if (!identity.personId) return { ok: false, reason: 'no_community_access' };
  const activeMemberships = await getActiveMemberships(identity.personId);
  const scoped = activeMemberships.filter((m) => m.communityId === community.id);

  if (scoped.length === 0) return { ok: false, reason: 'no_community_access' };
  if (scoped.length === 1) {
    return {
      ok: true,
      result: await createTokens(user, scoped[0], identity, subject.isPlatformAdmin),
    };
  }

  const selectionToken = jwt.sign(
    {
      sub: accountId,
      ...identity,
      email: user.email,
      purpose: 'context_selection',
    },
    config.jwt.secret,
    { expiresIn: '10m' },
  );

  return {
    ok: true,
    result: { requiresContextSelection: true, memberships: scoped, selectionToken },
  };
}
