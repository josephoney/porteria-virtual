import { eq, and, countDistinct, inArray, or, ilike, sql, type SQL } from 'drizzle-orm';
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

/**
 * Columnas de la identidad expuesta por el recurso de usuarios. La cuenta es la
 * fuente de verdad; la persona aporta los datos de perfil.
 */
const accountPersonColumns = {
  id: accounts.id,
  personId: accounts.personId,
  email: accounts.email,
  active: accounts.active,
  isPlatformAdmin: accounts.isPlatformAdmin,
  createdAt: accounts.createdAt,
  updatedAt: accounts.updatedAt,
  firstName: people.firstName,
  lastName: people.lastName,
  documentNumber: people.documentNumber,
  phone: people.phone,
};

interface AccountPersonRow {
  id: string;
  personId: string;
  email: string;
  active: boolean;
  isPlatformAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
  firstName: string;
  lastName: string;
  documentNumber: string | null;
  phone: string | null;
}

const db = createDb();

function fullName(row: AccountPersonRow): string {
  return [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
}

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
  const enriched = await enrichMembershipViews(data.flatMap((user) => user.memberships));
  const membershipsById = new Map(enriched.map((membership) => [membership.id, membership]));
  return data.map((user) => ({
    ...user,
    memberships: user.memberships.map(
      (membership) => membershipsById.get(membership.id) ?? membership,
    ),
  }));
}

function toUserResult(
  row: AccountPersonRow,
  membershipRows: (typeof memberships.$inferSelect)[],
): UserResult {
  const name = fullName(row);
  return {
    id: row.id,
    accountId: row.id,
    personId: row.personId,
    personName: name || null,
    personDocumentNumber: row.documentNumber ?? null,
    personPhone: row.phone ?? null,
    email: row.email,
    name: name || row.email,
    isPlatformAdmin: row.isPlatformAdmin,
    active: row.active,
    memberships: membershipRows.map(toMembershipView),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function canManage(requester: Requester): boolean {
  return (
    requester.isPlatformAdmin ||
    requester.role === 'org_admin' ||
    requester.role === 'community_admin'
  );
}

function scopeConditions(requester: Requester, targetPersonId: string) {
  const conditions = [eq(memberships.personId, targetPersonId)];
  if (!requester.isPlatformAdmin) {
    conditions.push(eq(memberships.organizationId, requester.orgId));
  }
  if (requester.role === 'community_admin' && requester.communityId) {
    conditions.push(eq(memberships.communityId, requester.communityId));
  }
  return conditions;
}

export async function getUserById(id: string, requester: Requester): Promise<UserResult | null> {
  const [account] = await db
    .select(accountPersonColumns)
    .from(accounts)
    .innerJoin(people, eq(accounts.personId, people.id))
    .where(eq(accounts.id, id))
    .limit(1);
  if (!account) return null;

  // La sesión identifica la cuenta y el recurso también: ser uno mismo es una
  // comparación directa entre el id del path y el claim de la sesión.
  const isSelf = requester.accountId === id;
  if (!isSelf && !canManage(requester)) return null;

  const membershipRows = isSelf
    ? await db.select().from(memberships).where(eq(memberships.personId, account.personId))
    : await db
        .select()
        .from(memberships)
        .where(and(...scopeConditions(requester, account.personId)));

  if (!isSelf && membershipRows.length === 0) return null;

  const [result] = await enrichUsers([toUserResult(account, membershipRows)]);
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
    const term = `%${search}%`;
    const searchCondition = or(
      ilike(accounts.email, term),
      ilike(sql`${people.firstName} || ' ' || ${people.lastName}`, term),
      ilike(people.firstName, term),
      ilike(people.lastName, term),
      ilike(people.documentNumber, term),
    );
    if (searchCondition) filterConditions.push(searchCondition);
  }
  if (status) {
    filterConditions.push(eq(accounts.active, status === 'active'));
  }

  const scopeWhereClause = scopeConditions.length > 0 ? and(...scopeConditions) : undefined;
  const whereClause =
    scopeConditions.length > 0 || filterConditions.length > 0
      ? and(...scopeConditions, ...filterConditions)
      : undefined;

  const accountRows = await db
    .selectDistinct({ id: accounts.id, createdAt: accounts.createdAt })
    .from(accounts)
    .innerJoin(people, eq(accounts.personId, people.id))
    .innerJoin(memberships, eq(memberships.personId, accounts.personId))
    .where(whereClause)
    .orderBy(accounts.createdAt, accounts.id)
    .limit(pageSize)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: countDistinct(accounts.id) })
    .from(accounts)
    .innerJoin(people, eq(accounts.personId, people.id))
    .innerJoin(memberships, eq(memberships.personId, accounts.personId))
    .where(whereClause);

  const [scopeTotalRow] = await db
    .select({ count: countDistinct(accounts.id) })
    .from(accounts)
    .innerJoin(memberships, eq(memberships.personId, accounts.personId))
    .where(scopeWhereClause);

  const ids = accountRows.map((row) => row.id);
  if (ids.length === 0) {
    return {
      data: [],
      total: totalRow?.count ?? 0,
      scopeTotal: scopeTotalRow?.count ?? 0,
      page,
      pageSize,
    };
  }

  const userRows = await db
    .select(accountPersonColumns)
    .from(accounts)
    .innerJoin(people, eq(accounts.personId, people.id))
    .where(inArray(accounts.id, ids));
  const usersById = new Map(userRows.map((row) => [row.id, row]));

  const personIds = [...new Set(userRows.map((row) => row.personId))];
  const membershipRows = personIds.length
    ? await db.select().from(memberships).where(inArray(memberships.personId, personIds))
    : [];
  const membershipsByPerson = new Map<string, (typeof memberships.$inferSelect)[]>();
  for (const membership of membershipRows) {
    const current = membershipsByPerson.get(membership.personId) ?? [];
    current.push(membership);
    membershipsByPerson.set(membership.personId, current);
  }

  const data = ids
    .map((id) => usersById.get(id))
    .filter((row): row is AccountPersonRow => Boolean(row))
    .map((row) => toUserResult(row, membershipsByPerson.get(row.personId) ?? []));

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
  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.email, data.email))
    .limit(1);
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
    // Escritura dual: `users` sigue recibiendo la fila legacy hasta el próximo
    // cambio; la identidad que expone la API es la cuenta.
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

    const [account] = await tx
      .insert(accounts)
      .values({
        personId: person.id,
        email: data.email,
        passwordHash,
        active: true,
        isPlatformAdmin: false,
      })
      .returning();

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

    return account;
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

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.name !== undefined) updates.name = data.name;
  if (data.active !== undefined) updates.active = data.active;

  await db.transaction(async (tx) => {
    // Escritura dual: se conserva la fila legacy hasta que `users` se retire.
    await tx.update(users).set(updates).where(eq(users.email, existing.email));

    const accountUpdates: Record<string, unknown> = { updatedAt: now };
    if (data.active !== undefined) accountUpdates.active = data.active;
    await tx.update(accounts).set(accountUpdates).where(eq(accounts.id, id));

    if (data.name !== undefined) {
      const [firstName, ...lastNameParts] = data.name.trim().split(/\s+/);
      await tx
        .update(people)
        .set({
          firstName: firstName || existing.email,
          lastName: lastNameParts.join(' '),
          updatedAt: now,
        })
        .where(eq(people.id, existing.personId!));
    }

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
  });

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
  const [account] = await db
    .select(accountPersonColumns)
    .from(accounts)
    .innerJoin(people, eq(accounts.personId, people.id))
    .where(eq(accounts.id, accountId))
    .limit(1);
  if (!account) return null;

  const membershipRows = await db
    .select()
    .from(memberships)
    .where(eq(memberships.personId, account.personId));
  const [result] = await enrichUsers([toUserResult(account, membershipRows)]);
  return result;
}

export async function countUsers(orgId: string): Promise<number> {
  const [result] = await db
    .select({ count: countDistinct(accounts.id) })
    .from(accounts)
    .innerJoin(memberships, eq(memberships.personId, accounts.personId))
    .where(eq(memberships.organizationId, orgId));
  return result?.count ?? 0;
}
