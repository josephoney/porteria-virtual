import { eq, and, count, countDistinct, inArray, or, ilike, type SQL } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  users,
  accounts,
  people,
  memberships,
  communities,
  locationUnits,
  organizations,
} from '@porteria/database/schema';
import { hashPassword, setPassword, verifyPassword } from './credentials.service.js';
import { userForAccount } from './auth.service.js';
import { createEventEnvelope, type MembershipRole } from '@porteria/shared';
import { enqueueEvent } from './outbox.service.js';

export interface Requester {
  sub: string;
  accountId?: string;
  role: string;
  orgId: string;
  communityId: string | null;
  isPlatformAdmin: boolean;
}

export interface MembershipView {
  id: string;
  role: string;
  status: string;
  organizationId: string;
  organizationName?: string | null;
  communityId: string | null;
  communityName?: string | null;
  unitId: string | null;
  locationUnitId: string | null;
  locationUnitName?: string | null;
  locationUnitCode?: string | null;
}

export interface UserResult {
  id: string;
  accountId?: string | null;
  personId?: string | null;
  personName?: string | null;
  personDocumentNumber?: string | null;
  personPhone?: string | null;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
  active: boolean;
  memberships: MembershipView[];
  createdAt: Date;
  updatedAt: Date;
}

const db = createDb();

function toMembershipView(row: typeof memberships.$inferSelect): MembershipView {
  return {
    id: row.id,
    role: row.role,
    status: row.status,
    organizationId: row.organizationId,
    communityId: row.communityId,
    unitId: row.unitId,
    locationUnitId: row.locationUnitId,
  };
}

async function enrichMembershipViews(views: MembershipView[]): Promise<MembershipView[]> {
  const organizationIds = [...new Set(views.map((view) => view.organizationId).filter(Boolean))];
  const communityIds = [
    ...new Set(views.map((view) => view.communityId).filter(Boolean)),
  ] as string[];
  const unitIds = [
    ...new Set(views.map((view) => view.locationUnitId).filter(Boolean)),
  ] as string[];
  const [organizationRows, communityRows, unitRows] = await Promise.all([
    organizationIds.length
      ? db
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(inArray(organizations.id, organizationIds))
      : Promise.resolve([]),
    communityIds.length
      ? db
          .select({ id: communities.id, name: communities.name })
          .from(communities)
          .where(inArray(communities.id, communityIds))
      : Promise.resolve([]),
    unitIds.length
      ? db
          .select({
            id: locationUnits.id,
            name: locationUnits.name,
            code: locationUnits.code,
          })
          .from(locationUnits)
          .where(inArray(locationUnits.id, unitIds))
      : Promise.resolve([]),
  ]);
  const organizationNames = new Map(organizationRows.map((row) => [row.id, row.name]));
  const communityNames = new Map(communityRows.map((row) => [row.id, row.name]));
  const unitMap = new Map(unitRows.map((row) => [row.id, row]));
  return views.map((view) => ({
    ...view,
    organizationName: view.organizationId
      ? (organizationNames.get(view.organizationId) ?? null)
      : null,
    communityName: view.communityId ? (communityNames.get(view.communityId) ?? null) : null,
    locationUnitName: view.locationUnitId ? (unitMap.get(view.locationUnitId)?.name ?? null) : null,
    locationUnitCode: view.locationUnitId ? (unitMap.get(view.locationUnitId)?.code ?? null) : null,
  }));
}

async function enrichUsers(data: UserResult[]): Promise<UserResult[]> {
  const [enriched, accountRows] = await Promise.all([
    enrichMembershipViews(data.flatMap((user) => user.memberships)),
    data.length
      ? db
          .select({
            id: accounts.id,
            personId: accounts.personId,
            email: accounts.email,
            firstName: people.firstName,
            lastName: people.lastName,
            documentNumber: people.documentNumber,
            phone: people.phone,
          })
          .from(accounts)
          .leftJoin(people, eq(accounts.personId, people.id))
          .where(
            inArray(
              accounts.email,
              data.map((user) => user.email),
            ),
          )
      : Promise.resolve([]),
  ]);
  const membershipsById = new Map(enriched.map((membership) => [membership.id, membership]));
  const accountsByEmail = new Map(accountRows.map((account) => [account.email, account]));
  return data.map((user) => {
    const account = accountsByEmail.get(user.email);
    return {
      ...user,
      accountId: account?.id ?? null,
      personId: account?.personId ?? null,
      personName: account
        ? [account.firstName, account.lastName].filter(Boolean).join(' ').trim() || null
        : null,
      personDocumentNumber: account?.documentNumber ?? null,
      personPhone: account?.phone ?? null,
      memberships: user.memberships.map(
        (membership) => membershipsById.get(membership.id) ?? membership,
      ),
    };
  });
}

function toUserResult(
  user: typeof users.$inferSelect,
  membershipRows: (typeof memberships.$inferSelect)[],
): UserResult {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    isPlatformAdmin: user.isPlatformAdmin,
    active: user.active,
    memberships: membershipRows.map(toMembershipView),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function canManage(requester: Requester): boolean {
  return (
    requester.isPlatformAdmin ||
    requester.role === 'org_admin' ||
    requester.role === 'community_admin'
  );
}

function scopeConditions(requester: Requester, targetUserId: string) {
  const conditions = [eq(memberships.userId, targetUserId)];
  if (!requester.isPlatformAdmin) {
    conditions.push(eq(memberships.organizationId, requester.orgId));
  }
  if (requester.role === 'community_admin' && requester.communityId) {
    conditions.push(eq(memberships.communityId, requester.communityId));
  }
  return conditions;
}

/** Resuelve la cuenta asociada a una fila de `users` por el email compartido. */
export async function accountIdForUserId(userId: string): Promise<string | null> {
  const [row] = await db
    .select({ accountId: accounts.id })
    .from(users)
    .innerJoin(accounts, eq(accounts.email, users.email))
    .where(eq(users.id, userId))
    .limit(1);
  return row?.accountId ?? null;
}

export async function getUserById(id: string, requester: Requester): Promise<UserResult | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return null;

  // La sesión identifica la cuenta, mientras que `id` sigue siendo el id de
  // `users` en esta fase. Ser uno mismo significa que ambos apuntan a la misma
  // fila: se resuelve la cuenta del objetivo y se compara con la de la sesión.
  const isSelf = requester.accountId
    ? (await accountIdForUserId(id)) === requester.accountId
    : false;
  if (!isSelf && !canManage(requester)) return null;

  const membershipRows = isSelf
    ? await db.select().from(memberships).where(eq(memberships.userId, id))
    : await db
        .select()
        .from(memberships)
        .where(and(...scopeConditions(requester, id)));

  if (!isSelf && membershipRows.length === 0) return null;

  const [result] = await enrichUsers([toUserResult(user, membershipRows)]);
  return result;
}

export async function listUsers(
  requester: Requester,
  options: {
    page: number;
    pageSize: number;
    communityId?: string;
    search?: string;
    status?: 'active' | 'inactive';
  },
): Promise<{
  data: UserResult[];
  total: number;
  scopeTotal: number;
  page: number;
  pageSize: number;
}> {
  const { page, pageSize, communityId, search, status } = options;
  const offset = (page - 1) * pageSize;

  const scopeConditions: SQL[] = [];
  if (!requester.isPlatformAdmin) {
    scopeConditions.push(eq(memberships.organizationId, requester.orgId));
  }
  if (requester.role === 'community_admin' && requester.communityId) {
    scopeConditions.push(eq(memberships.communityId, requester.communityId));
  } else if (communityId) {
    scopeConditions.push(eq(memberships.communityId, communityId));
  }

  const filterConditions: SQL[] = [];
  if (search) {
    const searchCondition = or(
      ilike(users.email, `%${search}%`),
      ilike(users.name, `%${search}%`),
      ilike(people.firstName, `%${search}%`),
      ilike(people.lastName, `%${search}%`),
      ilike(people.documentNumber, `%${search}%`),
    );
    if (searchCondition) filterConditions.push(searchCondition);
  }
  if (status) {
    filterConditions.push(eq(users.active, status === 'active'));
  }

  const scopeWhereClause = scopeConditions.length > 0 ? and(...scopeConditions) : undefined;
  const whereClause =
    scopeConditions.length > 0 || filterConditions.length > 0
      ? and(...scopeConditions, ...filterConditions)
      : undefined;

  const userIdRows = await db
    .selectDistinct({ id: users.id, createdAt: users.createdAt })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .leftJoin(accounts, eq(accounts.email, users.email))
    .leftJoin(people, eq(people.id, accounts.personId))
    .where(whereClause)
    .orderBy(users.createdAt)
    .limit(pageSize)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: countDistinct(users.id) })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .leftJoin(accounts, eq(accounts.email, users.email))
    .leftJoin(people, eq(people.id, accounts.personId))
    .where(whereClause);

  const [scopeTotalRow] = await db
    .select({ count: countDistinct(users.id) })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(scopeWhereClause);

  const ids = userIdRows.map((row) => row.id);
  if (ids.length === 0) {
    return {
      data: [],
      total: totalRow?.count ?? 0,
      scopeTotal: scopeTotalRow?.count ?? 0,
      page,
      pageSize,
    };
  }

  const userRows = await db.select().from(users).where(inArray(users.id, ids));
  const membershipRows = await db
    .select()
    .from(memberships)
    .where(inArray(memberships.userId, ids));

  const data = userRows.map((user) =>
    toUserResult(
      user,
      membershipRows.filter((m) => m.userId === user.id),
    ),
  );

  return {
    data: await enrichUsers(data),
    total: totalRow?.count ?? 0,
    scopeTotal: scopeTotalRow?.count ?? 0,
    page,
    pageSize,
  };
}

export async function createUser(
  data: {
    email: string;
    password: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    documentType?: string;
    documentNumber?: string;
    phone?: string;
    role: string;
    communityId?: string | null;
    communityIds?: string[];
    unitId?: string | null;
    locationUnitId?: string | null;
  },
  requester: Requester,
): Promise<UserResult | null> {
  const [existing] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
  if (existing) return null;

  const communityIds = data.communityIds?.length
    ? [...new Set(data.communityIds)]
    : [requester.role === 'community_admin' ? requester.communityId : (data.communityId ?? null)];
  const passwordHash = await hashPassword(data.password);
  const displayName =
    data.name?.trim() ||
    [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
    data.email;

  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({
        email: data.email,
        passwordHash,
        name: displayName,
        active: true,
      })
      .returning();

    const [derivedFirstName, ...derivedLastNameParts] = displayName.split(/\s+/);
    const [person] = await tx
      .insert(people)
      .values({
        firstName: data.firstName?.trim() || derivedFirstName || data.email,
        lastName: data.lastName?.trim() ?? derivedLastNameParts.join(' '),
        documentType: data.documentType,
        documentNumber: data.documentNumber,
        phone: data.phone,
        contactEmail: data.email,
        status: 'active',
      })
      .returning();

    await tx.insert(accounts).values({
      personId: person.id,
      email: data.email,
      passwordHash,
      active: true,
      isPlatformAdmin: false,
    });

    for (const communityId of communityIds) {
      const [membership] = await tx
        .insert(memberships)
        .values({
          userId: user.id,
          personId: person.id,
          organizationId: requester.orgId,
          communityId,
          unitId: communityIds.length === 1 ? (data.unitId ?? null) : null,
          locationUnitId: communityIds.length === 1 ? (data.locationUnitId ?? null) : null,
          role: data.role as MembershipRole,
          status: 'active',
        })
        .returning();

      await enqueueEvent(
        tx,
        createEventEnvelope({
          eventType: 'user.created',
          organizationId: requester.orgId,
          communityId,
          actorId: requester.sub,
          actorRole: requester.role,
          payload: {
            createdUserId: user.id,
            createdUserRole: data.role,
            membershipId: membership.id,
          },
        }),
      );
    }

    return user;
  });

  return getUserById(result.id, requester);
}

export async function updateUser(
  id: string,
  data: { name?: string; active?: boolean },
  requester: Requester,
): Promise<UserResult | null> {
  const existing = await getUserById(id, requester);
  if (!existing) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.active !== undefined) updates.active = data.active;

  const updated = await db.transaction(async (tx) => {
    const [row] = await tx.update(users).set(updates).where(eq(users.id, id)).returning();
    if (!row) return null;

    await enqueueEvent(
      tx,
      createEventEnvelope({
        eventType: 'user.updated',
        organizationId: existing.memberships[0]?.organizationId ?? requester.orgId,
        communityId: existing.memberships[0]?.communityId ?? null,
        actorId: requester.sub,
        actorRole: requester.role,
        payload: { updatedUserId: id, changedFields: Object.keys(data) },
      }),
    );

    return row;
  });

  if (!updated) return null;
  return getUserById(id, requester);
}

export async function changePassword(
  accountId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const [account] = await db
    .select({ id: accounts.id, passwordHash: accounts.passwordHash })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!account) return false;

  const valid = await verifyPassword(currentPassword, account.passwordHash);
  if (!valid) return false;

  // La contraseña vive sólo en `accounts` y el cambio revoca las sesiones
  // abiertas de la cuenta en la misma transacción.
  await setPassword(account.id, newPassword);

  return true;
}

export async function getMe(accountId: string): Promise<UserResult | null> {
  const user = await userForAccount(accountId);
  if (!user) return null;
  const membershipRows = await db.select().from(memberships).where(eq(memberships.userId, user.id));
  return toUserResult(user, membershipRows);
}

export async function countUsers(orgId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(users)
    .innerJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(memberships.organizationId, orgId));
  return result?.count ?? 0;
}
