import { and, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  users,
  accounts,
  memberships,
  refreshTokens,
  communities,
} from '@porteria/database/schema';
import type {
  AuthUserSummary,
  LoginResponse,
  MembershipSummary,
  RefreshResponse,
} from '@porteria/shared';
import bcrypt from 'bcryptjs';
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

function toAuthUser(
  user: typeof users.$inferSelect,
  isPlatformAdmin = user.isPlatformAdmin,
): AuthUserSummary {
  return {
    id: user.id,
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

async function getActiveMemberships(userId: string): Promise<MembershipSummary[]> {
  const rows = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.status, 'active')));
  return rows.map(toMembershipSummary);
}

interface AccountIdentity {
  accountId?: string;
  personId?: string;
}

async function identityForUser(user: typeof users.$inferSelect): Promise<AccountIdentity> {
  const [account] = await db
    .select({ id: accounts.id, personId: accounts.personId })
    .from(accounts)
    .where(eq(accounts.email, user.email))
    .limit(1);
  return account ? { accountId: account.id, personId: account.personId } : {};
}

interface AuthenticatedSubject {
  user: typeof users.$inferSelect;
  identity: AccountIdentity;
  isPlatformAdmin: boolean;
}

async function authenticate(email: string, password: string): Promise<AuthenticatedSubject | null> {
  const [account] = await db
    .select({
      id: accounts.id,
      personId: accounts.personId,
      passwordHash: accounts.passwordHash,
      active: accounts.active,
      isPlatformAdmin: accounts.isPlatformAdmin,
    })
    .from(accounts)
    .where(eq(accounts.email, email))
    .limit(1);

  if (account) {
    if (!account.active) return null;
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) return null;
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.active) return null;

  if (!account) {
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return null;
  }

  return {
    user,
    identity: account ? { accountId: account.id, personId: account.personId } : {},
    isPlatformAdmin: user.isPlatformAdmin || Boolean(account?.isPlatformAdmin),
  };
}

async function isPlatformAdminForUser(user: typeof users.$inferSelect): Promise<boolean> {
  const [account] = await db
    .select({ active: accounts.active, isPlatformAdmin: accounts.isPlatformAdmin })
    .from(accounts)
    .where(eq(accounts.email, user.email))
    .limit(1);
  if (account && !account.active) return false;
  return user.isPlatformAdmin || Boolean(account?.isPlatformAdmin);
}

async function createTokens(
  user: typeof users.$inferSelect,
  membership: MembershipSummary,
  identity: AccountIdentity = {},
  isPlatformAdmin = user.isPlatformAdmin,
): Promise<AuthResult> {
  const payload: JwtContextPayload = {
    sub: user.id,
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
    userId: user.id,
    accountId: identity.accountId ?? null,
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

  if (subject.isPlatformAdmin) {
    return createTokens(user, platformMembership(), identity, subject.isPlatformAdmin);
  }

  const activeMemberships = await getActiveMemberships(user.id);
  if (activeMemberships.length === 0) return null;
  if (activeMemberships.length === 1) {
    return createTokens(user, activeMemberships[0], identity, subject.isPlatformAdmin);
  }

  const selectionToken = jwt.sign(
    {
      sub: user.id,
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
  userId: string,
  membershipId: string,
): Promise<MembershipSummary | null> {
  const [membership] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.id, membershipId),
        eq(memberships.userId, userId),
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

  const [user] = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1);
  if (!user || !user.active) return null;

  let membership: MembershipSummary | null;
  const isPlatformAdmin = await isPlatformAdminForUser(user);
  if (parsed.membershipId === PLATFORM_MEMBERSHIP_ID) {
    if (!isPlatformAdmin) return null;
    membership = platformMembership();
  } else {
    membership = await resolveMembership(user.id, parsed.membershipId);
  }

  if (!membership) return null;
  return createTokens(user, membership, await identityForUser(user), isPlatformAdmin);
}

export async function switchContext(
  userId: string,
  membershipId: string,
  currentRefreshToken?: string,
): Promise<AuthResult | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user || !user.active) return null;

  const isPlatformAdmin = await isPlatformAdminForUser(user);
  let membership: MembershipSummary | null;
  if (membershipId === PLATFORM_MEMBERSHIP_ID) {
    if (!isPlatformAdmin) return null;
    membership = platformMembership();
  } else {
    membership = await resolveMembership(user.id, membershipId);
  }

  if (!membership) return null;

  if (currentRefreshToken) {
    await db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.tokenHash, hashToken(currentRefreshToken)));
  }

  return createTokens(user, membership, await identityForUser(user), isPlatformAdmin);
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

  const [user] = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1);
  if (!user) return null;

  if (parsed.membershipId === PLATFORM_MEMBERSHIP_ID) {
    return {
      userId: user.id,
      role: 'staff',
      organizationId: '',
      membershipId: PLATFORM_MEMBERSHIP_ID,
    };
  }

  const membership = await resolveMembership(user.id, parsed.membershipId);
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

  if (subject.isPlatformAdmin) {
    return {
      ok: true,
      result: await createTokens(user, platformMembership(), identity, true),
    };
  }

  const activeMemberships = await getActiveMemberships(user.id);
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
      sub: user.id,
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
