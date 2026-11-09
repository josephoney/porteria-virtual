import { and, eq, isNull, desc } from 'drizzle-orm';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createDb } from '@porteria/database';
import {
  invitations,
  users,
  accounts,
  people,
  memberships,
  communities,
  units,
  locationUnits,
} from '@porteria/database/schema';
import type { MembershipRole, PublicInvitationPreview } from '@porteria/shared';
import config from '../config.js';
import { validateMembershipScope } from './memberships.service.js';
import { validateLocationUnit } from './location-unit.service.js';
import * as authService from './auth.service.js';

const db = createDb();

export interface InvitationRequester {
  sub: string;
  role: string;
  orgId: string;
  communityId: string | null;
  isPlatformAdmin: boolean;
}

export interface CreateInvitationInput {
  email: string;
  role: MembershipRole;
  organizationId?: string;
  communityId?: string | null;
  unitId?: string | null;
  locationUnitId?: string | null;
  expiresInDays?: number;
}

export type InvitationErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'invalid_payload'
  | 'conflict'
  | 'login_required'
  | 'email_mismatch'
  | 'gone';

export type InvitationResult<T> = { ok: true; data: T } | { ok: false; code: InvitationErrorCode };

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
}

function buildAcceptUrl(token: string): string {
  return `${config.publicAppUrl}/invite/${token}`;
}

function expiryDate(days?: number): Date {
  const validDays = days && days > 0 ? days : config.invitationExpiryDays;
  return new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
}

function resolveScope(data: CreateInvitationInput, requester: InvitationRequester) {
  const organizationId = requester.isPlatformAdmin
    ? data.organizationId
    : requester.orgId;

  if (!organizationId) {
    return { error: 'organizationId is required' as const };
  }

  if (!requester.isPlatformAdmin && data.organizationId && data.organizationId !== requester.orgId) {
    return { error: 'organization out of scope' as const };
  }

  const communityId =
    requester.role === 'community_admin'
      ? requester.communityId
      : (data.communityId ?? null);

  if (requester.role === 'community_admin' && data.communityId && data.communityId !== requester.communityId) {
    return { error: 'community out of scope' as const };
  }

  const locationUnitId = data.locationUnitId ?? data.unitId ?? null;
  const scopeError = validateMembershipScope(data.role, communityId, locationUnitId);
  if (scopeError) return { error: scopeError };

  return {
    organizationId,
    communityId,
    unitId: data.unitId ?? null,
    locationUnitId: data.locationUnitId ?? null,
  };
}

function canManage(invitation: typeof invitations.$inferSelect, requester: InvitationRequester) {
  if (requester.isPlatformAdmin) return true;
  if (requester.role === 'org_admin') return invitation.organizationId === requester.orgId;
  if (requester.role === 'community_admin') {
    return (
      invitation.organizationId === requester.orgId &&
      invitation.communityId === requester.communityId
    );
  }
  return false;
}

async function findMembership(
  userId: string,
  organizationId: string,
  communityId: string | null,
  unitId: string | null,
  role: string,
) {
  const conditions = [
    eq(memberships.userId, userId),
    eq(memberships.organizationId, organizationId),
    eq(memberships.role, role as MembershipRole),
    eq(memberships.status, 'active'),
  ];
  conditions.push(communityId ? eq(memberships.communityId, communityId) : isNull(memberships.communityId));
  conditions.push(unitId ? eq(memberships.unitId, unitId) : isNull(memberships.unitId));

  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(...conditions))
    .limit(1);
  return membership ?? null;
}

export async function createInvitation(
  data: CreateInvitationInput,
  requester: InvitationRequester,
): Promise<InvitationResult<{ invitation: typeof invitations.$inferSelect; acceptUrl: string }>> {
  if (!requester.isPlatformAdmin && requester.role !== 'org_admin' && requester.role !== 'community_admin') {
    return { ok: false, code: 'forbidden' };
  }

  const scope = resolveScope(data, requester);
  if ('error' in scope) {
    return { ok: false, code: 'invalid_payload' };
  }

  if (scope.locationUnitId && scope.communityId) {
    const location = await validateLocationUnit(
      scope.locationUnitId,
      scope.communityId,
    );
    if (!location.ok) {
      return { ok: false, code: 'invalid_payload' };
    }
  }

  if (data.role === 'org_admin' && !requester.isPlatformAdmin) {
    return { ok: false, code: 'forbidden' };
  }

  const email = data.email.trim().toLowerCase();

  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existingUser) {
    const existingMembership = await findMembership(
      existingUser.id,
      scope.organizationId,
      scope.communityId,
      scope.unitId,
      data.role,
    );
    if (existingMembership) {
      return { ok: false, code: 'conflict' };
    }
  }

  const token = generateToken();
  const [invitation] = await db
    .insert(invitations)
    .values({
      tokenHash: hashToken(token),
      email,
      organizationId: scope.organizationId,
      communityId: scope.communityId,
      unitId: scope.unitId,
      locationUnitId: scope.locationUnitId,
      role: data.role,
      status: 'pending',
      expiresAt: expiryDate(data.expiresInDays),
      invitedBy: requester.sub,
    })
    .returning();

  return { ok: true, data: { invitation, acceptUrl: buildAcceptUrl(token) } };
}

export async function listInvitations(
  requester: InvitationRequester,
  filters: { status?: string; communityId?: string },
): Promise<(typeof invitations.$inferSelect)[]> {
  const conditions = [];
  if (!requester.isPlatformAdmin) {
    conditions.push(eq(invitations.organizationId, requester.orgId));
  }
  if (requester.role === 'community_admin' && requester.communityId) {
    conditions.push(eq(invitations.communityId, requester.communityId));
  } else if (filters.communityId) {
    conditions.push(eq(invitations.communityId, filters.communityId));
  }
  if (filters.status) {
    conditions.push(eq(invitations.status, filters.status as 'pending'));
  }

  return db
    .select()
    .from(invitations)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invitations.createdAt))
    .limit(100);
}

export async function revokeInvitation(
  id: string,
  requester: InvitationRequester,
): Promise<InvitationResult<typeof invitations.$inferSelect>> {
  const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
  if (!invitation) return { ok: false, code: 'not_found' };
  if (!canManage(invitation, requester)) return { ok: false, code: 'forbidden' };

  const [updated] = await db
    .update(invitations)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(invitations.id, id))
    .returning();

  return { ok: true, data: updated };
}

export async function resendInvitation(
  id: string,
  requester: InvitationRequester,
): Promise<InvitationResult<{ invitation: typeof invitations.$inferSelect; acceptUrl: string }>> {
  const [invitation] = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
  if (!invitation) return { ok: false, code: 'not_found' };
  if (!canManage(invitation, requester)) return { ok: false, code: 'forbidden' };
  if (invitation.status !== 'pending') return { ok: false, code: 'gone' };

  const token = generateToken();
  const [updated] = await db
    .update(invitations)
    .set({
      tokenHash: hashToken(token),
      expiresAt: expiryDate(),
      updatedAt: new Date(),
    })
    .where(eq(invitations.id, id))
    .returning();

  return { ok: true, data: { invitation: updated, acceptUrl: buildAcceptUrl(token) } };
}

async function buildLocationPath(locationUnitId: string): Promise<string | null> {
  const parts: string[] = [];
  let currentId: string | null = locationUnitId;
  for (let depth = 0; depth < 10 && currentId; depth += 1) {
    const [node] = await db
      .select({ name: locationUnits.name, parentId: locationUnits.parentId })
      .from(locationUnits)
      .where(eq(locationUnits.id, currentId))
      .limit(1);
    if (!node) break;
    parts.unshift(node.name);
    currentId = node.parentId;
  }
  return parts.length ? parts.join(' / ') : null;
}

type InvitationPreviewWithPath = PublicInvitationPreview & {
  locationPath: string | null;
};

export async function previewInvitation(
  token: string,
): Promise<InvitationResult<InvitationPreviewWithPath>> {
  const [row] = await db
    .select({
      invitation: invitations,
      communityName: communities.name,
      unitCode: units.code,
      locationUnitCode: locationUnits.code,
    })
    .from(invitations)
    .leftJoin(communities, eq(invitations.communityId, communities.id))
    .leftJoin(units, eq(invitations.unitId, units.id))
    .leftJoin(locationUnits, eq(invitations.locationUnitId, locationUnits.id))
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);

  if (!row) return { ok: false, code: 'not_found' };
  if (row.invitation.status !== 'pending') return { ok: false, code: 'gone' };
  if (row.invitation.expiresAt.getTime() < Date.now()) {
    return { ok: false, code: 'gone' };
  }

  const locationPath = row.invitation.locationUnitId
    ? await buildLocationPath(row.invitation.locationUnitId)
    : null;

  return {
    ok: true,
    data: {
      communityName: row.communityName ?? 'Comunidad',
      unitCode: row.locationUnitCode ?? row.unitCode ?? null,
      locationPath,
      role: row.invitation.role,
      maskedEmail: maskEmail(row.invitation.email),
      expiresAt: row.invitation.expiresAt,
    },
  };
}

export async function acceptInvitation(
  token: string,
  body: { name?: string; password?: string },
  authenticatedUserId?: string,
): Promise<InvitationResult<authService.AuthResult>> {
  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.tokenHash, hashToken(token)))
    .limit(1);

  if (!invitation) return { ok: false, code: 'not_found' };
  if (invitation.status !== 'pending') return { ok: false, code: 'gone' };
  if (invitation.expiresAt.getTime() < Date.now()) {
    await db
      .update(invitations)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(eq(invitations.id, invitation.id));
    return { ok: false, code: 'gone' };
  }

  const email = invitation.email;
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existingUser) {
    if (!authenticatedUserId) return { ok: false, code: 'login_required' };
    if (existingUser.id !== authenticatedUserId) return { ok: false, code: 'email_mismatch' };

    const [existingPerson] = await db
      .select({ id: people.id })
      .from(people)
      .where(eq(people.contactEmail, existingUser.email))
      .limit(1);

    await db
      .insert(memberships)
      .values({
        userId: existingUser.id,
        personId: existingPerson?.id ?? null,
        organizationId: invitation.organizationId,
        communityId: invitation.communityId,
        unitId: invitation.unitId,
        locationUnitId: invitation.locationUnitId,
        role: invitation.role,
        status: 'active',
      })
      .onConflictDoNothing();

    const membership = await findMembership(
      existingUser.id,
      invitation.organizationId,
      invitation.communityId,
      invitation.unitId,
      invitation.role,
    );
    if (!membership) return { ok: false, code: 'conflict' };

    await db
      .update(invitations)
      .set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    const tokens = await authService.switchContext(existingUser.id, membership.id);
    if (!tokens) return { ok: false, code: 'conflict' };
    return { ok: true, data: tokens };
  }

  if (!body.name || !body.password || body.password.length < 8) {
    return { ok: false, code: 'invalid_payload' };
  }

  const passwordHash = await bcrypt.hash(body.password, 10);

  try {
    const tokens = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email,
          name: body.name!,
          passwordHash,
          active: true,
          isPlatformAdmin: false,
        })
        .returning();

      const [firstName, ...lastNameParts] = body.name!.trim().split(/\s+/);
      const [person] = await tx
        .insert(people)
        .values({
          firstName: firstName || email,
          lastName: lastNameParts.join(' '),
          contactEmail: email,
          status: 'active',
        })
        .returning();

      await tx.insert(accounts).values({
        personId: person.id,
        email,
        passwordHash,
        active: true,
        isPlatformAdmin: false,
      });

      const [membership] = await tx
        .insert(memberships)
        .values({
          userId: user.id,
          personId: person.id,
          organizationId: invitation.organizationId,
          communityId: invitation.communityId,
          unitId: invitation.unitId,
          locationUnitId: invitation.locationUnitId,
          role: invitation.role,
          status: 'active',
        })
        .returning();

      await tx
        .update(invitations)
        .set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() })
        .where(eq(invitations.id, invitation.id));

      return { userId: user.id, membershipId: membership.id };
    });

    const auth = await authService.switchContext(tokens.userId, tokens.membershipId);
    if (!auth) return { ok: false, code: 'conflict' };
    return { ok: true, data: auth };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === '23505') return { ok: false, code: 'conflict' };
    throw err;
  }
}
