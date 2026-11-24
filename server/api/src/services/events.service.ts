import { eq, and, gte, lte, count, desc, sql, inArray, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { createDb } from '@porteria/database';
import type { EventEnvelope } from '@porteria/shared';
import type { DbExecutor } from './outbox.service.js';
import {
  accessPasses,
  accessPoints,
  accounts,
  communities,
  events,
  ingestedEvents,
  organizations,
  passScans,
  people,
} from '@porteria/database/schema';

const db = createDb();

/**
 * Trazabilidad del código involucrado en el evento. Se lee del pase y del
 * escaneo reales, no de la copia que quedó dentro de `metadata`: el evento
 * técnico sirve para diagnosticar y tiene que mostrar el estado actual.
 */
export interface EventTraceability {
  passId: string;
  /** Identificador visible del pase. El pase no tiene otro código público. */
  passCode: string;
  visitorName: string | null;
  passCreatedAt: Date | null;
  passCreatedBy: string | null;
  authorizedBy: string | null;
  scanId: string | null;
  scanAction: string | null;
  scanStatus: string | null;
  scannedAt: Date | null;
  confirmedAt: Date | null;
  reason: string | null;
  note: string | null;
  scanGuard: string | null;
}

export interface EventResult {
  id: string;
  eventType: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  organizationId: string;
  organizationName: string | null;
  communityId: string | null;
  communityName: string | null;
  accessPointId: string | null;
  accessPointName: string | null;
  metadata: Record<string, unknown>;
  trace: EventTraceability | null;
  createdAt: Date;
}

export interface ListEventsFilters {
  page: number;
  pageSize: number;
  /** Solo lo usa el superadmin para acotar la vista global a una organización. */
  organizationId?: string;
  eventType?: string;
  from?: string;
  to?: string;
  actorId?: string;
  actor?: string;
  accessPointId?: string;
  communityId?: string;
}

function personName(firstName: string | null, lastName: string | null): string | null {
  return [firstName, lastName].filter(Boolean).join(' ').trim() || null;
}

function readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export async function listEvents(
  filters: ListEventsFilters,
): Promise<{ data: EventResult[]; total: number; page: number; pageSize: number }> {
  const offset = (filters.page - 1) * filters.pageSize;
  const conditions = [];

  if (filters.organizationId) {
    conditions.push(eq(events.organizationId, filters.organizationId));
  }
  if (filters.eventType) conditions.push(eq(events.eventType, filters.eventType));
  if (filters.from) conditions.push(gte(events.createdAt, new Date(filters.from)));
  if (filters.to) conditions.push(lte(events.createdAt, new Date(filters.to)));
  if (filters.actorId) conditions.push(eq(events.actorId, filters.actorId));
  if (filters.accessPointId) conditions.push(eq(events.accessPointId, filters.accessPointId));
  if (filters.communityId) conditions.push(eq(events.communityId, filters.communityId));

  // El actor puede venir como persona directa o como cuenta. El nombre vive en
  // `people`, así que se resuelve con joins (una sola consulta para toda la
  // página) en lugar de una subconsulta por fila.
  const directActor = alias(people, 'direct_actor');
  const actorAccount = alias(accounts, 'actor_account');
  const accountActor = alias(people, 'account_actor');
  const actorNameExpr = sql<string | null>`coalesce(
    nullif(trim(concat_ws(' ', ${directActor.firstName}, ${directActor.lastName})), ''),
    nullif(trim(concat_ws(' ', ${accountActor.firstName}, ${accountActor.lastName})), '')
  )`;

  if (filters.actor) {
    conditions.push(sql`coalesce(${actorNameExpr}, '') ilike ${`%${filters.actor}%`}`);
  }

  const where = and(...conditions);

  const data = await db
    .select({
      id: events.id,
      eventType: events.eventType,
      actorId: events.actorId,
      actorRole: events.actorRole,
      actorName: actorNameExpr,
      organizationId: events.organizationId,
      organizationName: organizations.name,
      communityId: events.communityId,
      communityName: communities.name,
      accessPointId: events.accessPointId,
      accessPointName: accessPoints.name,
      metadata: events.metadata,
      createdAt: events.createdAt,
    })
    .from(events)
    .leftJoin(organizations, eq(organizations.id, events.organizationId))
    .leftJoin(communities, eq(communities.id, events.communityId))
    .leftJoin(accessPoints, eq(accessPoints.id, events.accessPointId))
    .leftJoin(directActor, eq(directActor.id, events.actorPersonId))
    .leftJoin(actorAccount, eq(actorAccount.id, events.actorId))
    .leftJoin(accountActor, eq(accountActor.id, actorAccount.personId))
    .where(where)
    .orderBy(desc(events.createdAt))
    .limit(filters.pageSize)
    .offset(offset);

  const [result] = await db
    .select({ count: count() })
    .from(events)
    .leftJoin(organizations, eq(organizations.id, events.organizationId))
    .leftJoin(communities, eq(communities.id, events.communityId))
    .leftJoin(accessPoints, eq(accessPoints.id, events.accessPointId))
    .leftJoin(directActor, eq(directActor.id, events.actorPersonId))
    .leftJoin(actorAccount, eq(actorAccount.id, events.actorId))
    .leftJoin(accountActor, eq(accountActor.id, actorAccount.personId))
    .where(where);

  const traces = await loadTraceability(data);

  return {
    data: data.map((row) => ({
      id: row.id,
      eventType: row.eventType,
      actorId: row.actorId,
      actorRole: row.actorRole,
      actorName: row.actorName ?? null,
      organizationId: row.organizationId,
      organizationName: row.organizationName ?? null,
      communityId: row.communityId,
      communityName: row.communityName ?? null,
      accessPointId: row.accessPointId,
      accessPointName: row.accessPointName ?? null,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      trace: traces.get(row.id) ?? null,
      createdAt: row.createdAt,
    })),
    total: result?.count ?? 0,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

interface PassTraceRow {
  id: string;
  visitorFirstName: string;
  visitorLastName: string;
  createdAt: Date;
  createdByFirstName: string | null;
  createdByLastName: string | null;
  authorizedByFirstName: string | null;
  authorizedByLastName: string | null;
}

interface ScanTraceRow {
  id: string;
  passId: string;
  action: string;
  status: string;
  scannedAt: Date;
  confirmedAt: Date | null;
  reason: string | null;
  note: string | null;
  guardFirstName: string | null;
  guardLastName: string | null;
}

/**
 * Carga pases y escaneos de toda la página en dos consultas batcheadas.
 * Nunca se consulta por fila: la página trae como máximo `pageSize` eventos.
 */
async function loadTraceability(
  rows: Array<{ id: string; metadata: unknown }>,
): Promise<Map<string, EventTraceability>> {
  const traces = new Map<string, EventTraceability>();

  const eventKeys = rows.map((row) => {
    const metadata =
      typeof row.metadata === 'object' && row.metadata !== null
        ? (row.metadata as Record<string, unknown>)
        : {};
    return {
      id: row.id,
      passId: readMetadataString(metadata, 'passId'),
      scanId: readMetadataString(metadata, 'scanId'),
    };
  });

  const passIdSet = new Set<string>();
  const scanIdSet = new Set<string>();
  for (const key of eventKeys) {
    if (key.passId) passIdSet.add(key.passId);
    if (key.scanId) scanIdSet.add(key.scanId);
  }

  if (passIdSet.size === 0 && scanIdSet.size === 0) return traces;

  const scanIds = [...scanIdSet];
  const passIds = [...passIdSet];
  let scans: ScanTraceRow[] = [];

  if (scanIds.length > 0 || passIds.length > 0) {
    const guardPerson = alias(people, 'scan_guard');
    const scanCondition =
      scanIds.length > 0 && passIds.length > 0
        ? or(inArray(passScans.id, scanIds), inArray(passScans.passId, passIds))
        : scanIds.length > 0
          ? inArray(passScans.id, scanIds)
          : inArray(passScans.passId, passIds);

    scans = await db
      .select({
        id: passScans.id,
        passId: passScans.passId,
        action: passScans.action,
        status: passScans.status,
        scannedAt: passScans.scannedAt,
        confirmedAt: passScans.confirmedAt,
        reason: passScans.reason,
        note: passScans.note,
        guardFirstName: guardPerson.firstName,
        guardLastName: guardPerson.lastName,
      })
      .from(passScans)
      .leftJoin(guardPerson, eq(guardPerson.id, passScans.guardPersonId))
      .where(scanCondition);
  }

  for (const scan of scans) passIdSet.add(scan.passId);

  const allPassIds = [...passIdSet];
  if (allPassIds.length === 0) return traces;

  const creator = alias(people, 'pass_creator');
  const authorizer = alias(people, 'pass_authorizer');
  const passRows: PassTraceRow[] = await db
    .select({
      id: accessPasses.id,
      visitorFirstName: accessPasses.visitorFirstName,
      visitorLastName: accessPasses.visitorLastName,
      createdAt: accessPasses.createdAt,
      createdByFirstName: creator.firstName,
      createdByLastName: creator.lastName,
      authorizedByFirstName: authorizer.firstName,
      authorizedByLastName: authorizer.lastName,
    })
    .from(accessPasses)
    .leftJoin(creator, eq(creator.id, accessPasses.createdByPersonId))
    .leftJoin(authorizer, eq(authorizer.id, accessPasses.authorizedByPersonId))
    .where(inArray(accessPasses.id, allPassIds));

  const passById = new Map(passRows.map((row) => [row.id, row]));
  const scanById = new Map(scans.map((row) => [row.id, row]));
  const latestScanByPass = new Map<string, ScanTraceRow>();
  for (const scan of scans) {
    const current = latestScanByPass.get(scan.passId);
    if (!current || scan.scannedAt > current.scannedAt) {
      latestScanByPass.set(scan.passId, scan);
    }
  }

  for (const key of eventKeys) {
    const { passId, scanId } = key;
    const scan =
      (scanId ? scanById.get(scanId) : undefined) ??
      (passId ? latestScanByPass.get(passId) : undefined) ??
      null;
    const pass =
      (passId ? passById.get(passId) : undefined) ?? (scan ? passById.get(scan.passId) : undefined);
    if (!pass && !scan) continue;

    const resolvedPassId = pass?.id ?? scan?.passId ?? passId;
    if (!resolvedPassId) continue;

    traces.set(key.id, {
      passId: resolvedPassId,
      passCode: resolvedPassId,
      visitorName: pass ? personName(pass.visitorFirstName, pass.visitorLastName) : null,
      passCreatedAt: pass?.createdAt ?? null,
      passCreatedBy: pass ? personName(pass.createdByFirstName, pass.createdByLastName) : null,
      authorizedBy: pass ? personName(pass.authorizedByFirstName, pass.authorizedByLastName) : null,
      scanId: scan?.id ?? null,
      scanAction: scan?.action ?? null,
      scanStatus: scan?.status ?? null,
      scannedAt: scan?.scannedAt ?? null,
      confirmedAt: scan?.confirmedAt ?? null,
      reason: scan?.reason ?? null,
      note: scan?.note ?? null,
      scanGuard: scan ? personName(scan.guardFirstName, scan.guardLastName) : null,
    });
  }

  return traces;
}

export interface EventStats {
  byType: Record<string, number>;
  total: number;
}

export async function getEventStats(
  organizationId?: string,
  from?: string,
  to?: string,
  communityId?: string,
): Promise<EventStats> {
  const startDate = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
  const conditions = [gte(events.createdAt, startDate)];
  if (organizationId) conditions.push(eq(events.organizationId, organizationId));
  if (to) conditions.push(lte(events.createdAt, new Date(to)));
  if (communityId) conditions.push(eq(events.communityId, communityId));

  const rows = await db
    .select({ eventType: events.eventType, count: count() })
    .from(events)
    .where(and(...conditions))
    .groupBy(events.eventType);

  const byType: Record<string, number> = {};
  let total = 0;

  for (const row of rows) {
    byType[row.eventType] = row.count;
    total += row.count;
  }

  return { byType, total };
}

export async function getEventsTodayCount(
  orgId: string,
  from?: string,
  to?: string,
  communityId?: string,
): Promise<number> {
  const startDate = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
  const conditions = [eq(events.organizationId, orgId), gte(events.createdAt, startDate)];
  if (to) conditions.push(lte(events.createdAt, new Date(to)));
  if (communityId) conditions.push(eq(events.communityId, communityId));

  const [result] = await db
    .select({ count: count() })
    .from(events)
    .where(and(...conditions));

  return result?.count ?? 0;
}

export async function resolveOrgIdFromCommunityId(communityId: string): Promise<string> {
  const [row] = await db
    .select({ orgId: communities.organizationId })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);

  if (!row) {
    throw new Error(`No organization found for community ${communityId}`);
  }

  return row.orgId;
}

export async function insertEvent(
  event: {
    eventType: string;
    actorId?: string | null;
    actorPersonId?: string | null;
    actorRole?: string | null;
    organizationId: string;
    communityId?: string | null;
    accessPointId?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  executor: DbExecutor = db,
): Promise<void> {
  await executor.insert(events).values({
    eventType: event.eventType,
    actorId: event.actorId ?? null,
    actorPersonId: event.actorPersonId ?? null,
    actorRole: event.actorRole ?? null,
    organizationId: event.organizationId,
    communityId: event.communityId ?? null,
    accessPointId: event.accessPointId ?? null,
    metadata: event.metadata ?? undefined,
  });
}
export async function ingestEnvelope(envelope: EventEnvelope): Promise<{ duplicate: boolean }> {
  return db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(ingestedEvents)
      .values({ eventId: envelope.eventId })
      .onConflictDoNothing()
      .returning({ eventId: ingestedEvents.eventId });

    if (!inserted) return { duplicate: true };

    await tx.insert(events).values({
      eventType: envelope.eventType,
      actorId: envelope.actor?.id ?? null,
      actorRole: envelope.actor?.role ?? envelope.actorRole ?? null,
      organizationId: envelope.organizationId,
      communityId: envelope.communityId ?? null,
      accessPointId: envelope.accessPointId ?? null,
      metadata: {
        ...envelope.payload,
        eventId: envelope.eventId,
        occurredAt: envelope.occurredAt,
      },
    });

    return { duplicate: false };
  });
}
