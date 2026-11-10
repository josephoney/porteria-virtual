import { and, count, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  accessPoints,
  accounts,
  bitacoraComments,
  bitacoraEntries,
  communities,
  guardShiftSegments,
  guardShifts,
  memberships,
  people,
} from '@porteria/database/schema';
import type {
  BitacoraCommentDto,
  BitacoraEntryDetailDto,
  BitacoraEntryDto,
  BitacoraEntryType,
  BitacoraListResponse,
  BitacoraSource,
  CreateBitacoraCommentDto,
  CreateBitacoraEntryDto,
} from '@porteria/shared';
import type { DbExecutor } from './outbox.service.js';

const db = createDb();

export interface BitacoraRequester {
  sub: string;
  personId?: string;
  accountId?: string;
  role: string;
  orgId: string;
  communityId: string | null;
  membershipId?: string;
  isPlatformAdmin: boolean;
}

export type BitacoraResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'forbidden' | 'invalid' };

export interface InsertBitacoraEntryInput {
  communityId: string;
  accessPointId: string;
  accessPointName: string;
  shiftId?: string | null;
  type: BitacoraEntryType;
  source: BitacoraSource;
  authorPersonId?: string | null;
  authorAccountId?: string | null;
  passId?: string | null;
  passScanId?: string | null;
  summary: string;
  details?: Record<string, unknown>;
}

export interface BitacoraQuery {
  communityId?: string;
  accessPointId?: string;
  shiftId?: string;
  type?: BitacoraEntryType;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

type EntryRow = typeof bitacoraEntries.$inferSelect;

async function resolvePersonId(requester: BitacoraRequester): Promise<string | null> {
  if (requester.personId) return requester.personId;
  if (!requester.membershipId || requester.membershipId === 'platform') return null;
  const [row] = await db
    .select({ personId: memberships.personId })
    .from(memberships)
    .where(eq(memberships.id, requester.membershipId))
    .limit(1);
  return row?.personId ?? null;
}

export async function insertBitacoraEntry(
  executor: DbExecutor,
  input: InsertBitacoraEntryInput,
): Promise<EntryRow> {
  const [row] = await executor
    .insert(bitacoraEntries)
    .values({
      communityId: input.communityId,
      accessPointId: input.accessPointId,
      accessPointName: input.accessPointName,
      shiftId: input.shiftId ?? null,
      type: input.type,
      source: input.source,
      authorPersonId: input.authorPersonId ?? null,
      authorAccountId: input.authorAccountId ?? null,
      passId: input.passId ?? null,
      passScanId: input.passScanId ?? null,
      summary: input.summary,
      details: input.details ?? {},
    })
    .returning();
  return row;
}

function maskDocument(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return '***';
  return `***${trimmed.slice(-4)}`;
}

function maskDetails(details: unknown): Record<string, unknown> {
  const clone =
    typeof details === 'object' && details !== null
      ? (JSON.parse(JSON.stringify(details)) as Record<string, unknown>)
      : {};
  const visitor = clone.visitor;
  if (visitor && typeof visitor === 'object') {
    const visitorRecord = visitor as Record<string, unknown>;
    if (typeof visitorRecord.document === 'string') {
      visitorRecord.document = maskDocument(visitorRecord.document);
    }
  }
  if (typeof clone.visitorDocument === 'string') {
    clone.visitorDocument = maskDocument(clone.visitorDocument);
  }
  return clone;
}

function authorName(
  firstName: string | null,
  lastName: string | null,
  email: string | null,
): string | null {
  if (firstName || lastName) return [firstName, lastName].filter(Boolean).join(' ');
  return email;
}

function toEntryDto(
  row: EntryRow,
  author: { firstName: string | null; lastName: string | null; email: string | null },
  commentCount: number,
  full: boolean,
): BitacoraEntryDto {
  return {
    id: row.id,
    communityId: row.communityId,
    accessPointId: row.accessPointId,
    accessPointName: row.accessPointName,
    shiftId: row.shiftId,
    type: row.type,
    source: row.source,
    authorName: authorName(author.firstName, author.lastName, author.email),
    passId: row.passId,
    passScanId: row.passScanId,
    summary: row.summary,
    details: full ? ((row.details as Record<string, unknown>) ?? {}) : maskDetails(row.details),
    commentCount,
    createdAt: row.createdAt.toISOString(),
  };
}

async function canReadEntry(requester: BitacoraRequester, entry: EntryRow): Promise<boolean> {
  if (requester.isPlatformAdmin) return true;

  if (requester.role === 'org_admin') {
    const [community] = await db
      .select({ organizationId: communities.organizationId })
      .from(communities)
      .where(eq(communities.id, entry.communityId))
      .limit(1);
    return Boolean(community && community.organizationId === requester.orgId);
  }

  if (requester.role === 'community_admin') {
    return entry.communityId === requester.communityId;
  }

  if (requester.role === 'guard') {
    const personId = await resolvePersonId(requester);
    if (!personId) return false;
    const [segment] = await db
      .select({ id: guardShiftSegments.id })
      .from(guardShiftSegments)
      .innerJoin(guardShifts, eq(guardShiftSegments.shiftId, guardShifts.id))
      .where(
        and(
          eq(guardShifts.guardPersonId, personId),
          eq(guardShiftSegments.accessPointId, entry.accessPointId),
        ),
      )
      .limit(1);
    return Boolean(segment);
  }

  return false;
}

async function guardHasOpenSegment(
  requester: BitacoraRequester,
  accessPointId: string,
): Promise<boolean> {
  const personId = await resolvePersonId(requester);
  if (!personId) return false;
  const [row] = await db
    .select({ id: guardShiftSegments.id })
    .from(guardShiftSegments)
    .innerJoin(guardShifts, eq(guardShiftSegments.shiftId, guardShifts.id))
    .where(
      and(
        eq(guardShifts.guardPersonId, personId),
        eq(guardShifts.status, 'open'),
        isNull(guardShiftSegments.endedAt),
        eq(guardShiftSegments.accessPointId, accessPointId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function loadAccessPoint(accessPointId: string) {
  const [row] = await db
    .select({
      id: accessPoints.id,
      name: accessPoints.name,
      communityId: accessPoints.communityId,
      active: accessPoints.active,
    })
    .from(accessPoints)
    .where(eq(accessPoints.id, accessPointId))
    .limit(1);
  return row ?? null;
}

async function loadAuthor(entry: EntryRow) {
  const [row] = await db
    .select({
      firstName: people.firstName,
      lastName: people.lastName,
      email: accounts.email,
    })
    .from(people)
    .leftJoin(accounts, eq(accounts.personId, people.id))
    .where(eq(people.id, entry.authorPersonId ?? ''))
    .limit(1);
  return {
    firstName: row?.firstName ?? null,
    lastName: row?.lastName ?? null,
    email: row?.email ?? null,
  };
}

export async function listBitacora(
  requester: BitacoraRequester,
  query: BitacoraQuery,
): Promise<BitacoraResult<BitacoraListResponse>> {
  if (requester.role === 'operator' || requester.role === 'resident') {
    return { ok: false, code: 'forbidden' };
  }

  const conditions = [];
  if (query.communityId) conditions.push(eq(bitacoraEntries.communityId, query.communityId));
  if (query.accessPointId) {
    conditions.push(eq(bitacoraEntries.accessPointId, query.accessPointId));
  }
  if (query.shiftId) conditions.push(eq(bitacoraEntries.shiftId, query.shiftId));
  if (query.type) conditions.push(eq(bitacoraEntries.type, query.type));
  if (query.from) conditions.push(gte(bitacoraEntries.createdAt, new Date(query.from)));
  if (query.to) conditions.push(lte(bitacoraEntries.createdAt, new Date(query.to)));

  if (requester.isPlatformAdmin) {
    if (!query.communityId) return { ok: false, code: 'forbidden' };
  } else if (requester.role === 'org_admin') {
    const orgCommunities = await db
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.organizationId, requester.orgId));
    const ids = orgCommunities.map((row) => row.id);
    if (ids.length === 0) {
      return {
        ok: true,
        data: { items: [], page: query.page, pageSize: query.pageSize, total: 0 },
      };
    }
    conditions.push(inArray(bitacoraEntries.communityId, ids));
  } else if (requester.role === 'community_admin') {
    if (!requester.communityId) return { ok: false, code: 'forbidden' };
    conditions.push(eq(bitacoraEntries.communityId, requester.communityId));
  } else if (requester.role === 'guard') {
    const personId = await resolvePersonId(requester);
    if (!personId) return { ok: false, code: 'forbidden' };
    const segments = await db
      .select({ accessPointId: guardShiftSegments.accessPointId })
      .from(guardShiftSegments)
      .innerJoin(guardShifts, eq(guardShiftSegments.shiftId, guardShifts.id))
      .where(eq(guardShifts.guardPersonId, personId))
      .groupBy(guardShiftSegments.accessPointId);
    const ids = segments.map((row) => row.accessPointId);
    if (ids.length === 0) {
      return {
        ok: true,
        data: { items: [], page: query.page, pageSize: query.pageSize, total: 0 },
      };
    }
    conditions.push(inArray(bitacoraEntries.accessPointId, ids));
  } else {
    return { ok: false, code: 'forbidden' };
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [totalRow] = await db.select({ value: count() }).from(bitacoraEntries).where(where);
  const total = Number(totalRow?.value ?? 0);

  const rows = await db
    .select({
      entry: bitacoraEntries,
      firstName: people.firstName,
      lastName: people.lastName,
      email: accounts.email,
    })
    .from(bitacoraEntries)
    .leftJoin(people, eq(bitacoraEntries.authorPersonId, people.id))
    .leftJoin(accounts, eq(bitacoraEntries.authorAccountId, accounts.id))
    .where(where)
    .orderBy(desc(bitacoraEntries.createdAt))
    .limit(query.pageSize)
    .offset((query.page - 1) * query.pageSize);

  const entryIds = rows.map((row) => row.entry.id);
  const commentCounts = new Map<string, number>();
  if (entryIds.length > 0) {
    const counts = await db
      .select({ entryId: bitacoraComments.entryId, value: count() })
      .from(bitacoraComments)
      .where(inArray(bitacoraComments.entryId, entryIds))
      .groupBy(bitacoraComments.entryId);
    for (const row of counts) commentCounts.set(row.entryId, Number(row.value));
  }

  return {
    ok: true,
    data: {
      items: rows.map((row) =>
        toEntryDto(
          row.entry,
          { firstName: row.firstName, lastName: row.lastName, email: row.email },
          commentCounts.get(row.entry.id) ?? 0,
          false,
        ),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
    },
  };
}

export async function getBitacoraEntry(
  requester: BitacoraRequester,
  entryId: string,
): Promise<BitacoraResult<BitacoraEntryDetailDto>> {
  const [entry] = await db
    .select()
    .from(bitacoraEntries)
    .where(eq(bitacoraEntries.id, entryId))
    .limit(1);

  if (!entry) return { ok: false, code: 'not_found' };
  if (!(await canReadEntry(requester, entry))) return { ok: false, code: 'forbidden' };

  const author = await loadAuthor(entry);
  const comments = await db
    .select({
      comment: bitacoraComments,
      firstName: people.firstName,
      lastName: people.lastName,
      email: accounts.email,
    })
    .from(bitacoraComments)
    .leftJoin(people, eq(bitacoraComments.authorPersonId, people.id))
    .leftJoin(accounts, eq(bitacoraComments.authorAccountId, accounts.id))
    .where(eq(bitacoraComments.entryId, entryId))
    .orderBy(bitacoraComments.createdAt);

  const commentDtos: BitacoraCommentDto[] = comments.map((row) => ({
    id: row.comment.id,
    authorName: authorName(row.firstName, row.lastName, row.email),
    body: row.comment.body,
    createdAt: row.comment.createdAt.toISOString(),
  }));

  return {
    ok: true,
    data: {
      ...toEntryDto(entry, author, commentDtos.length, true),
      comments: commentDtos,
    },
  };
}

export async function createManualEntry(
  requester: BitacoraRequester,
  input: CreateBitacoraEntryDto,
): Promise<BitacoraResult<BitacoraEntryDetailDto>> {
  if (requester.role === 'operator' || requester.role === 'resident') {
    return { ok: false, code: 'forbidden' };
  }

  const accessPoint = await loadAccessPoint(input.accessPointId);
  if (!accessPoint) return { ok: false, code: 'not_found' };

  if (requester.role === 'guard') {
    if (!accessPoint.active) return { ok: false, code: 'invalid' };
    if (!(await guardHasOpenSegment(requester, accessPoint.id))) {
      return { ok: false, code: 'forbidden' };
    }
    if (requester.communityId !== accessPoint.communityId) {
      return { ok: false, code: 'forbidden' };
    }
  } else if (requester.role === 'community_admin') {
    if (requester.communityId !== accessPoint.communityId) {
      return { ok: false, code: 'forbidden' };
    }
  } else if (requester.role === 'org_admin') {
    const [community] = await db
      .select({ organizationId: communities.organizationId })
      .from(communities)
      .where(eq(communities.id, accessPoint.communityId))
      .limit(1);
    if (!community || community.organizationId !== requester.orgId) {
      return { ok: false, code: 'forbidden' };
    }
  } else if (requester.isPlatformAdmin) {
    return { ok: false, code: 'forbidden' };
  } else {
    return { ok: false, code: 'forbidden' };
  }

  const personId = await resolvePersonId(requester);
  const row = await insertBitacoraEntry(db, {
    communityId: accessPoint.communityId,
    accessPointId: accessPoint.id,
    accessPointName: accessPoint.name,
    shiftId: null,
    type: 'manual',
    source: 'dashboard',
    authorPersonId: personId,
    authorAccountId: requester.accountId ?? null,
    summary: input.summary,
    details: input.details ?? {},
  });

  const detail = await getBitacoraEntry(requester, row.id);
  return detail;
}

export async function addComment(
  requester: BitacoraRequester,
  entryId: string,
  input: CreateBitacoraCommentDto,
): Promise<BitacoraResult<BitacoraCommentDto>> {
  const [entry] = await db
    .select()
    .from(bitacoraEntries)
    .where(eq(bitacoraEntries.id, entryId))
    .limit(1);

  if (!entry) return { ok: false, code: 'not_found' };
  if (!(await canReadEntry(requester, entry))) return { ok: false, code: 'forbidden' };

  if (requester.role === 'guard') {
    if (!(await guardHasOpenSegment(requester, entry.accessPointId))) {
      return { ok: false, code: 'forbidden' };
    }
  }

  const personId = await resolvePersonId(requester);
  const [row] = await db
    .insert(bitacoraComments)
    .values({
      entryId,
      authorPersonId: personId,
      authorAccountId: requester.accountId ?? null,
      body: input.body,
    })
    .returning();

  const [author] = await db
    .select({
      firstName: people.firstName,
      lastName: people.lastName,
      email: accounts.email,
    })
    .from(people)
    .leftJoin(accounts, eq(accounts.personId, people.id))
    .where(eq(people.id, personId ?? ''))
    .limit(1);

  return {
    ok: true,
    data: {
      id: row.id,
      authorName: authorName(
        author?.firstName ?? null,
        author?.lastName ?? null,
        author?.email ?? null,
      ),
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    },
  };
}
