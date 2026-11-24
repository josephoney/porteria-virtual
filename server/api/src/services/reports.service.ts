import { eq, and, gte, lte, inArray, count, avg as sqlAvg, sql } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { calls, events, memberships, bitacoraEntries } from '@porteria/database/schema';
import type {
  DailyReport,
  WeeklyReport,
  MonthlyReport,
  CallStats,
  EventTimeSeries,
  AccessReport,
  AccessReportSeriesPoint,
  ReportGranularity,
  ShiftReport,
} from '@porteria/shared';
import { resultCondition } from './bitacora.service.js';
import { dayEnd, dayStart, parseLocalDate, toLocalDateString } from '../lib/report-dates.js';

const db = createDb();

function callCommunityFilter(communityId?: string) {
  return communityId ? sql`AND community_id = ${communityId}::uuid` : sql``;
}

function eventCommunityFilter(communityId?: string) {
  return communityId ? sql`AND community_id = ${communityId}::uuid` : sql``;
}

export async function getDailyReport(
  orgId: string,
  date?: string,
  communityId?: string,
): Promise<DailyReport> {
  const targetDate = date || toLocalDateString(new Date());
  const start = dayStart(targetDate);
  const end = dayEnd(targetDate);

  const callConditions = [
    eq(calls.organizationId, orgId),
    gte(calls.startedAt, start),
    lte(calls.startedAt, end),
  ];
  if (communityId) callConditions.push(eq(calls.communityId, communityId));

  const eventConditions = [
    eq(events.organizationId, orgId),
    eq(events.eventType, 'door.open'),
    gte(events.createdAt, start),
    lte(events.createdAt, end),
  ];
  if (communityId) eventConditions.push(eq(events.communityId, communityId));

  const callsByHourFilter = callCommunityFilter(communityId);
  const allEventsConditions = [
    eq(events.organizationId, orgId),
    gte(events.createdAt, start),
    lte(events.createdAt, end),
  ];
  if (communityId) allEventsConditions.push(eq(events.communityId, communityId));

  const operatorConditions = [
    eq(memberships.organizationId, orgId),
    eq(memberships.role, 'operator'),
    eq(memberships.status, 'active'),
  ];
  if (communityId) operatorConditions.push(eq(memberships.communityId, communityId));

  const [callCounts, doorOpens, callsByHour, activeOperators] = await Promise.all([
    db
      .select({ status: calls.status, count: count() })
      .from(calls)
      .where(and(...callConditions))
      .groupBy(calls.status),

    db
      .select({ count: count() })
      .from(events)
      .where(and(...eventConditions)),

    db.execute<{ hour: number; count: number }>(sql`
      SELECT EXTRACT(HOUR FROM started_at)::int AS hour, COUNT(*)::int AS count
      FROM calls
      WHERE organization_id = ${orgId}::uuid
        ${callsByHourFilter}
        AND started_at >= ${start.toISOString()}::timestamptz
        AND started_at < ${new Date(end.getTime() + 86400000).toISOString()}::timestamptz
      GROUP BY hour
      ORDER BY hour
    `),

    db
      .select({ count: count() })
      .from(memberships)
      .where(and(...operatorConditions)),
  ]);

  const statusMap: Record<string, number> = {};
  let totalCalls = 0;
  for (const row of callCounts) {
    statusMap[row.status as string] = row.count;
    totalCalls += row.count;
  }

  const eventsByType = await db
    .select({ eventType: events.eventType, count: count() })
    .from(events)
    .where(and(...allEventsConditions))
    .groupBy(events.eventType);

  return {
    date: targetDate,
    totalCalls,
    answeredCalls: (statusMap['ended'] || 0) + (statusMap['active'] || 0),
    missedCalls: statusMap['missed'] || 0,
    callsByHour: callsByHour.rows,
    totalDoorOpens: doorOpens[0]?.count ?? 0,
    eventsByType: eventsByType.map((r) => ({ eventType: r.eventType, count: r.count })),
    activeOperators: activeOperators[0]?.count ?? 0,
  };
}

export async function getWeeklyReport(
  orgId: string,
  weekStart?: string,
  communityId?: string,
): Promise<WeeklyReport> {
  let monday: Date;
  if (weekStart) {
    monday = dayStart(weekStart);
  } else {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    monday = new Date(now.getFullYear(), now.getMonth(), diff);
    monday.setHours(0, 0, 0, 0);
  }

  const days: WeeklyReport['days'] = [];
  const totals = { calls: 0, answered: 0, missed: 0, doors: 0 };

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = toLocalDateString(dayDate);
    const start = dayStart(dateStr);
    const end = dayEnd(dateStr);

    const callConditions = [
      eq(calls.organizationId, orgId),
      gte(calls.startedAt, start),
      lte(calls.startedAt, end),
    ];
    if (communityId) callConditions.push(eq(calls.communityId, communityId));

    const eventConditions = [
      eq(events.organizationId, orgId),
      eq(events.eventType, 'door.open'),
      gte(events.createdAt, start),
      lte(events.createdAt, end),
    ];
    if (communityId) eventConditions.push(eq(events.communityId, communityId));

    const [dayCalls, dayDoors] = await Promise.all([
      db
        .select({ status: calls.status, count: count() })
        .from(calls)
        .where(and(...callConditions))
        .groupBy(calls.status),

      db
        .select({ count: count() })
        .from(events)
        .where(and(...eventConditions)),
    ]);

    const statusMap: Record<string, number> = {};
    let dayTotal = 0;
    for (const row of dayCalls) {
      statusMap[row.status as string] = row.count;
      dayTotal += row.count;
    }
    const answered = (statusMap['ended'] || 0) + (statusMap['active'] || 0);
    const missed = statusMap['missed'] || 0;
    const doors = dayDoors[0]?.count ?? 0;

    days.push({
      date: dateStr,
      totalCalls: dayTotal,
      answeredCalls: answered,
      missedCalls: missed,
      doorOpens: doors,
    });
    totals.calls += dayTotal;
    totals.answered += answered;
    totals.missed += missed;
    totals.doors += doors;
  }

  return { weekStart: toLocalDateString(monday), days, totals };
}

export async function getMonthlyReport(
  orgId: string,
  month?: string,
  communityId?: string,
): Promise<MonthlyReport> {
  const target = month || toLocalDateString(new Date()).slice(0, 7);
  const [y, m] = target.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

  const callFilter = callCommunityFilter(communityId);
  const eventFilter = eventCommunityFilter(communityId);

  const result = await db.execute<{
    week_start: string;
    total_calls: number;
    answered: number;
    missed: number;
    doors: number;
  }>(sql`
    WITH week_buckets AS (
      SELECT
        date_trunc('week', started_at)::date AS week_start,
        COUNT(*)::int AS total_calls,
        COUNT(*) FILTER (WHERE status IN ('ended', 'active'))::int AS answered,
        COUNT(*) FILTER (WHERE status = 'missed')::int AS missed
      FROM calls
      WHERE organization_id = ${orgId}::uuid
        ${callFilter}
        AND started_at >= ${monthStart.toISOString()}::timestamptz
        AND started_at <= ${monthEnd.toISOString()}::timestamptz
      GROUP BY week_start
    ),
    door_weeks AS (
      SELECT
        date_trunc('week', created_at)::date AS week_start,
        COUNT(*)::int AS doors
      FROM events
      WHERE organization_id = ${orgId}::uuid
        ${eventFilter}
        AND event_type = 'door.open'
        AND created_at >= ${monthStart.toISOString()}::timestamptz
        AND created_at <= ${monthEnd.toISOString()}::timestamptz
      GROUP BY week_start
    )
    SELECT
      COALESCE(w.week_start, d.week_start) AS week_start,
      COALESCE(w.total_calls, 0) AS total_calls,
      COALESCE(w.answered, 0) AS answered,
      COALESCE(w.missed, 0) AS missed,
      COALESCE(d.doors, 0) AS doors
    FROM week_buckets w
    FULL OUTER JOIN door_weeks d ON w.week_start = d.week_start
    ORDER BY week_start
  `);

  const weeks = result.rows.map((r) => ({
    weekStart: r.week_start,
    totalCalls: r.total_calls,
    answeredCalls: r.answered,
    missedCalls: r.missed,
    doorOpens: r.doors,
  }));

  const totals = weeks.reduce(
    (acc, w) => ({
      calls: acc.calls + w.totalCalls,
      answered: acc.answered + w.answeredCalls,
      missed: acc.missed + w.missedCalls,
      doors: acc.doors + w.doorOpens,
    }),
    { calls: 0, answered: 0, missed: 0, doors: 0 },
  );

  return { month: target, weeks, totals };
}

export async function getCallStats(
  orgId: string,
  from?: string,
  to?: string,
  communityId?: string,
): Promise<CallStats> {
  const defaultFrom = from || toLocalDateString(new Date(Date.now() - 7 * 86400000));
  const defaultTo = to || toLocalDateString(new Date());
  const start = dayStart(defaultFrom);
  const end = dayEnd(defaultTo);

  const conditions = [
    eq(calls.organizationId, orgId),
    gte(calls.startedAt, start),
    lte(calls.startedAt, end),
  ];
  if (communityId) conditions.push(eq(calls.communityId, communityId));

  const filter = callCommunityFilter(communityId);
  const kioskCommunityFilter = communityId ? sql`AND c.community_id = ${communityId}::uuid` : sql``;

  const [counts, avgResult, callsByHour, callsByKiosk] = await Promise.all([
    db
      .select({ status: calls.status, count: count() })
      .from(calls)
      .where(and(...conditions))
      .groupBy(calls.status),

    db
      .select({ avgDuration: sqlAvg(calls.duration) })
      .from(calls)
      .where(and(...conditions)),

    db.execute<{ hour: number; count: number }>(sql`
      SELECT EXTRACT(HOUR FROM started_at)::int AS hour, COUNT(*)::int AS count
      FROM calls
      WHERE organization_id = ${orgId}::uuid
        ${filter}
        AND started_at >= ${start.toISOString()}::timestamptz
        AND started_at <= ${end.toISOString()}::timestamptz
      GROUP BY hour
      ORDER BY hour
    `),

    db.execute<{ kioskId: string; kioskName: string; count: number }>(sql`
      SELECT k.id AS "kioskId", k.name AS "kioskName", COUNT(*)::int AS count
      FROM calls c
      INNER JOIN kiosks k ON c.kiosk_id = k.id
      WHERE c.organization_id = ${orgId}::uuid
        ${kioskCommunityFilter}
        AND c.started_at >= ${start.toISOString()}::timestamptz
        AND c.started_at <= ${end.toISOString()}::timestamptz
      GROUP BY k.id, k.name
      ORDER BY count DESC
    `),
  ]);

  const statusMap: Record<string, number> = {};
  let totalCalls = 0;
  for (const row of counts) {
    statusMap[row.status as string] = row.count;
    totalCalls += row.count;
  }

  const answeredCount = (statusMap['ended'] || 0) + (statusMap['active'] || 0);
  const missedCount = statusMap['missed'] || 0;

  return {
    totalCalls,
    answeredCount,
    missedCount,
    answerRate: totalCalls > 0 ? Math.round((answeredCount / totalCalls) * 100) : 0,
    avgDuration: Math.round(Number(avgResult[0]?.avgDuration) || 0),
    callsByHour: callsByHour.rows,
    callsByKiosk: callsByKiosk.rows,
  };
}

export async function getEventBreakdown(
  orgId: string,
  from: string,
  to: string,
  bucket: 'hour' | 'day' = 'day',
  communityId?: string,
): Promise<EventTimeSeries> {
  const start = new Date(from);
  const end = new Date(to);
  const bucketInterval = bucket === 'hour' ? '1 hour' : '1 day';
  const filter = eventCommunityFilter(communityId);

  const result = await db.execute<{ time: string; event_type: string; count: number }>(sql`
    SELECT
      -- date_bin es nativo desde Postgres 14; time_bucket exigia TimescaleDB,
      -- que la imagen estandar de Postgres no trae.
      date_bin(${bucketInterval}::interval, created_at, TIMESTAMPTZ '2000-01-01 00:00:00+00') AS time,
      event_type,
      COUNT(*)::int AS count
    FROM events
    WHERE organization_id = ${orgId}::uuid
      ${filter}
      AND created_at >= ${start.toISOString()}::timestamptz
      AND created_at <= ${end.toISOString()}::timestamptz
    GROUP BY time, event_type
    ORDER BY time
  `);

  const bucketMap = new Map<string, Record<string, string | number>>();
  for (const row of result.rows) {
    const timeKey = row.time;
    if (!bucketMap.has(timeKey)) {
      bucketMap.set(timeKey, { time: timeKey });
    }
    bucketMap.get(timeKey)![row.event_type] = row.count;
  }

  return { buckets: [...bucketMap.values()] } as unknown as EventTimeSeries;
}

/* -------------------------------------------------------------------------- */
/* Reportes de accesos y turnos                                               */
/* -------------------------------------------------------------------------- */

/**
 * Zona horaria con la que `report-dates` arma los rangos locales. Agrupar las
 * entradas en el día equivocado movería accesos entre series y horas.
 */
const REPORT_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export interface ReportsScope {
  organizationId: string;
  communityId?: string | null;
}

/** Tipos de la bitácora que representan accesos; los turnos no son accesos. */
const ACCESS_ENTRY_TYPES = [
  'pass_entry',
  'pass_exit',
  'pass_rejected',
  'scan_denied',
  'manual',
] as const;

function accessTypeCondition() {
  return inArray(bitacoraEntries.type, [...ACCESS_ENTRY_TYPES]);
}

/** Condición de resultado reutilizada de la bitácora legible. */
function accessResultCondition(result: 'authorized' | 'denied' | 'code_failure' | 'observation') {
  const condition = resultCondition(result);
  if (!condition) throw new Error(`Resultado sin condición: ${result}`);
  return condition;
}

/**
 * Dirección del acceso con la misma regla que la bitácora legible: los tipos
 * `pass_entry`/`pass_exit` mandan y, para rechazos y entradas manuales, se lee
 * `details.action` (`entry`/`exit`).
 */
const entryDirection = sql<string | null>`CASE
  WHEN ${bitacoraEntries.type} = 'pass_entry' THEN 'entry'
  WHEN ${bitacoraEntries.type} = 'pass_exit' THEN 'exit'
  WHEN ${bitacoraEntries.details} ->> 'action' IN ('entry', 'exit') THEN ${bitacoraEntries.details} ->> 'action'
  ELSE NULL
END`;

/**
 * El método sale de la fuente de la bitácora, no de `pass_scans.origin`:
 * `manual_identity` significa que el guardia verificó un documento.
 */
const entryMethod = sql<'qr' | 'document'>`CASE
  WHEN ${bitacoraEntries.source} = 'manual_identity' THEN 'document'
  ELSE 'qr'
END`;

function accessWhere(scope: ReportsScope, start: Date, end: Date) {
  return sql`
    INNER JOIN communities c ON c.id = bitacora_entries.community_id
    WHERE c.organization_id = ${scope.organizationId}::uuid
      ${scope.communityId ? sql`AND ${bitacoraEntries.communityId} = ${scope.communityId}::uuid` : sql``}
      AND ${bitacoraEntries.createdAt} >= ${start.toISOString()}::timestamptz
      AND ${bitacoraEntries.createdAt} <= ${end.toISOString()}::timestamptz
      AND ${accessTypeCondition()}
  `;
}

function shiftWhere(scope: ReportsScope, start: Date, end: Date) {
  return sql`
    INNER JOIN communities c ON c.id = gs.community_id
    WHERE c.organization_id = ${scope.organizationId}::uuid
      ${scope.communityId ? sql`AND gs.community_id = ${scope.communityId}::uuid` : sql``}
      AND gs.started_at >= ${start.toISOString()}::timestamptz
      AND gs.started_at <= ${end.toISOString()}::timestamptz
  `;
}

/** Primer día local de la semana (lunes) para una fecha `YYYY-MM-DD`. */
function weekStartKey(date: string): string {
  const value = parseLocalDate(date);
  const day = value.getDay();
  value.setDate(value.getDate() + (day === 0 ? -6 : 1 - day));
  return toLocalDateString(value);
}

/** Todas las fechas locales entre `from` y `to`, ambas incluidas. */
function reportDays(from: string, to: string): string[] {
  const days: string[] = [];
  const cursor = parseLocalDate(from);
  let key = toLocalDateString(cursor);
  while (key <= to) {
    days.push(key);
    cursor.setDate(cursor.getDate() + 1);
    key = toLocalDateString(cursor);
  }
  return days;
}

function seriesKey(day: string, granularity: ReportGranularity): string {
  if (granularity === 'day') return day;
  if (granularity === 'month') return day.slice(0, 7);
  return weekStartKey(day);
}

function emptySeriesPoint(date: string): AccessReportSeriesPoint {
  return {
    date,
    total: 0,
    authorized: 0,
    denied: 0,
    codeFailure: 0,
    observation: 0,
    entries: 0,
    exits: 0,
  };
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Constructor del reporte de accesos sobre `bitacora_entries`, la bitácora real
 * de portería: incluye ingresos y salidas QR, verificaciones por documento,
 * rechazos y observaciones manuales. Los eventos de turno quedan fuera.
 *
 * La latencia se mide sólo sobre accesos con un escaneo QR confirmado; la
 * cobertura (`confirmedScans / accessCount`) viaja en la respuesta para no
 * presentarla como si aplicara a todas las entradas.
 */
export async function getAccessReport(
  scope: ReportsScope,
  from: string,
  to: string,
  granularity: ReportGranularity = 'day',
): Promise<AccessReport> {
  const start = dayStart(from);
  const end = dayEnd(to);
  const where = accessWhere(scope, start, end);

  const [totalsResult, methods, accessPoints, hours, denialReasons, dailyResult, latencyResult] =
    await Promise.all([
      db.execute<{
        total: number;
        authorized: number;
        denied: number;
        code_failure: number;
        observation: number;
        entries: number;
        exits: number;
      }>(sql`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE ${accessResultCondition('authorized')}
        )::int AS authorized,
        COUNT(*) FILTER (
          WHERE ${accessResultCondition('denied')}
        )::int AS denied,
        COUNT(*) FILTER (
          WHERE ${accessResultCondition('code_failure')}
        )::int AS code_failure,
        COUNT(*) FILTER (
          WHERE ${accessResultCondition('observation')}
        )::int AS observation,
        COUNT(*) FILTER (WHERE ${entryDirection} = 'entry')::int AS entries,
        COUNT(*) FILTER (WHERE ${entryDirection} = 'exit')::int AS exits
      FROM bitacora_entries
      ${where}
    `),

      db.execute<{ method: 'qr' | 'document'; count: number }>(sql`
      SELECT ${entryMethod} AS method, COUNT(*)::int AS count
      FROM bitacora_entries
      ${where}
      GROUP BY method
      ORDER BY count DESC, method
    `),

      db.execute<{
        access_point_id: string | null;
        access_point_name: string | null;
        count: number;
      }>(sql`
      SELECT
        bitacora_entries.access_point_id AS access_point_id,
        bitacora_entries.access_point_name AS access_point_name,
        COUNT(*)::int AS count
      FROM bitacora_entries
      ${where}
      GROUP BY bitacora_entries.access_point_id, bitacora_entries.access_point_name
      ORDER BY count DESC, access_point_name
    `),

      db.execute<{ hour: number; count: number }>(sql`
      SELECT
        EXTRACT(
          HOUR FROM bitacora_entries.created_at AT TIME ZONE ${REPORT_TIME_ZONE}::text
        )::int AS hour,
        COUNT(*)::int AS count
      FROM bitacora_entries
      ${where}
      GROUP BY hour
      ORDER BY hour
    `),

      db.execute<{ reason: string | null; count: number }>(sql`
      SELECT ${bitacoraEntries.details} ->> 'reason' AS reason, COUNT(*)::int AS count
      FROM bitacora_entries
      ${where}
        AND ${accessResultCondition('denied')}
      GROUP BY reason
      ORDER BY count DESC, reason
    `),

      db.execute<{
        day: string;
        total: number;
        authorized: number;
        denied: number;
        code_failure: number;
        observation: number;
        entries: number;
        exits: number;
      }>(sql`
      SELECT
        TO_CHAR(
          bitacora_entries.created_at AT TIME ZONE ${REPORT_TIME_ZONE}::text,
          'YYYY-MM-DD'
        ) AS day,
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE ${accessResultCondition('authorized')}
        )::int AS authorized,
        COUNT(*) FILTER (
          WHERE ${accessResultCondition('denied')}
        )::int AS denied,
        COUNT(*) FILTER (
          WHERE ${accessResultCondition('code_failure')}
        )::int AS code_failure,
        COUNT(*) FILTER (
          WHERE ${accessResultCondition('observation')}
        )::int AS observation,
        COUNT(*) FILTER (WHERE ${entryDirection} = 'entry')::int AS entries,
        COUNT(*) FILTER (WHERE ${entryDirection} = 'exit')::int AS exits
      FROM bitacora_entries
      ${where}
      GROUP BY day
      ORDER BY day
    `),

      db.execute<{ avg_latency: string | null; confirmed_scans: number }>(sql`
      SELECT
        AVG(EXTRACT(EPOCH FROM ps.confirmed_at - ps.scanned_at)) AS avg_latency,
        COUNT(DISTINCT bitacora_entries.id)::int AS confirmed_scans
      FROM bitacora_entries
      INNER JOIN pass_scans ps ON ps.id = bitacora_entries.pass_scan_id
      ${where}
        AND ps.confirmed_at IS NOT NULL
    `),
    ]);

  const row = totalsResult.rows[0];
  const total = row?.total ?? 0;
  const authorized = row?.authorized ?? 0;
  const denied = row?.denied ?? 0;
  const codeFailure = row?.code_failure ?? 0;
  const observation = row?.observation ?? 0;

  const methodCounts = new Map(methods.rows.map((item) => [item.method, item.count]));
  const hourCounts = new Map(hours.rows.map((item) => [item.hour, item.count]));

  const daily = new Map<
    string,
    {
      total: number;
      authorized: number;
      denied: number;
      codeFailure: number;
      observation: number;
      entries: number;
      exits: number;
    }
  >();
  for (const item of dailyResult.rows) {
    daily.set(item.day, {
      total: item.total,
      authorized: item.authorized,
      denied: item.denied,
      codeFailure: item.code_failure,
      observation: item.observation,
      entries: item.entries,
      exits: item.exits,
    });
  }

  const buckets = new Map<string, AccessReportSeriesPoint>();
  for (const day of reportDays(from, to)) {
    const key = seriesKey(day, granularity);
    const point = buckets.get(key) ?? emptySeriesPoint(key);
    const counts = daily.get(day);
    if (counts) {
      point.total += counts.total;
      point.authorized += counts.authorized;
      point.denied += counts.denied;
      point.codeFailure += counts.codeFailure;
      point.observation += counts.observation;
      point.entries += counts.entries;
      point.exits += counts.exits;
    }
    buckets.set(key, point);
  }

  const latencyRow = latencyResult.rows[0];
  const rawLatency = latencyRow?.avg_latency == null ? null : Number(latencyRow.avg_latency);

  return {
    from,
    to,
    granularity,
    scope: {
      organizationId: scope.organizationId,
      communityId: scope.communityId ?? null,
    },
    totals: {
      total,
      authorized,
      denied,
      codeFailure,
      observation,
      entries: row?.entries ?? 0,
      exits: row?.exits ?? 0,
    },
    byMethod: (['qr', 'document'] as const).map((method) => ({
      method,
      count: methodCounts.get(method) ?? 0,
    })),
    byAccessPoint: accessPoints.rows.map((item) => ({
      accessPointId: item.access_point_id,
      accessPointName: item.access_point_name?.trim() || 'Sin portería',
      count: item.count,
    })),
    byHour: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: hourCounts.get(hour) ?? 0,
    })),
    denialReasons: denialReasons.rows.map((item) => ({
      reason: item.reason?.trim() || 'sin_motivo',
      count: item.count,
    })),
    latency: {
      averageSeconds: rawLatency == null ? null : Math.round(rawLatency * 10) / 10,
      confirmedScans: latencyRow?.confirmed_scans ?? 0,
      accessCount: total,
    },
    series: [...buckets.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

/**
 * Constructor del reporte de turnos sobre `guard_shifts`, con los accesos
 * atribuidos por `bitacora_entries.shift_id`. Un turno abierto no aporta horas:
 * se informa como abierto para no confundirlo con un turno de duración cero.
 */
export async function getShiftReport(
  scope: ReportsScope,
  from: string,
  to: string,
): Promise<ShiftReport> {
  const start = dayStart(from);
  const end = dayEnd(to);

  const result = await db.execute<{
    id: string;
    guard_person_id: string;
    guard_first_name: string | null;
    guard_last_name: string | null;
    status: 'open' | 'closed';
    started_at: Date | string;
    ended_at: Date | string | null;
  }>(sql`
    SELECT
      gs.id AS id,
      gs.guard_person_id AS guard_person_id,
      p.first_name AS guard_first_name,
      p.last_name AS guard_last_name,
      gs.status::text AS status,
      gs.started_at AS started_at,
      gs.ended_at AS ended_at
    FROM guard_shifts gs
    INNER JOIN people p ON p.id = gs.guard_person_id
    ${shiftWhere(scope, start, end)}
    ORDER BY gs.started_at DESC
  `);

  const shiftIds = result.rows.map((item) => item.id);
  const accessCounts = new Map<string, number>();
  if (shiftIds.length > 0) {
    const accessRows = await db
      .select({ shiftId: bitacoraEntries.shiftId, value: count() })
      .from(bitacoraEntries)
      .where(and(inArray(bitacoraEntries.shiftId, shiftIds), accessTypeCondition()))
      .groupBy(bitacoraEntries.shiftId);
    for (const accessRow of accessRows) {
      if (accessRow.shiftId) accessCounts.set(accessRow.shiftId, Number(accessRow.value));
    }
  }

  const guardMap = new Map<
    string,
    {
      guardPersonId: string;
      guardName: string;
      shifts: number;
      openShifts: number;
      closedShifts: number;
      hours: number;
      accesses: number;
    }
  >();

  // Los totales se acumulan en horas crudas y se redondean al final: sumar
  // horas ya redondeadas por turno desviaba el total respecto de la suma por
  // guardia y las dos cifras no coincidían en pantalla.
  let totalClosedShifts = 0;
  let totalOpenShifts = 0;
  let totalHours = 0;
  let totalAccesses = 0;

  const shifts = result.rows.map((item) => {
    const guardName =
      [item.guard_first_name, item.guard_last_name].filter(Boolean).join(' ').trim() ||
      'Sin nombre';
    const accesses = accessCounts.get(item.id) ?? 0;
    const startedAt = new Date(item.started_at);
    const endedAt = item.ended_at ? new Date(item.ended_at) : null;
    const closed = item.status === 'closed' && endedAt != null;
    const hours = closed
      ? Math.max(0, (endedAt!.getTime() - startedAt.getTime()) / 3_600_000)
      : null;

    const guard = guardMap.get(item.guard_person_id) ?? {
      guardPersonId: item.guard_person_id,
      guardName,
      shifts: 0,
      openShifts: 0,
      closedShifts: 0,
      hours: 0,
      accesses: 0,
    };
    guard.shifts += 1;
    guard.accesses += accesses;
    if (closed) {
      guard.closedShifts += 1;
      guard.hours += hours!;
    } else {
      guard.openShifts += 1;
    }
    guardMap.set(item.guard_person_id, guard);

    totalAccesses += accesses;
    if (closed) {
      totalClosedShifts += 1;
      totalHours += hours!;
    } else {
      totalOpenShifts += 1;
    }

    return {
      shiftId: item.id,
      guardPersonId: item.guard_person_id,
      guardName,
      status: item.status,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt ? endedAt.toISOString() : null,
      hours: hours == null ? null : roundHours(hours),
      accesses,
    };
  });

  const guards = [...guardMap.values()]
    .map((guard) => ({ ...guard, hours: roundHours(guard.hours) }))
    .sort((a, b) => b.hours - a.hours || a.guardName.localeCompare(b.guardName));

  const openShifts = shifts
    .filter((shift) => shift.hours === null)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((shift) => ({
      shiftId: shift.shiftId,
      guardPersonId: shift.guardPersonId,
      guardName: shift.guardName,
      startedAt: shift.startedAt,
    }));

  const totals = {
    shifts: shifts.length,
    openShifts: totalOpenShifts,
    closedShifts: totalClosedShifts,
    hours: roundHours(totalHours),
    accesses: totalAccesses,
  };

  return {
    from,
    to,
    scope: {
      organizationId: scope.organizationId,
      communityId: scope.communityId ?? null,
    },
    totals,
    guards,
    shifts,
    openShifts,
  };
}
