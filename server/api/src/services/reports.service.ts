import { eq, and, gte, lte, count, avg as sqlAvg, sql } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { calls, events } from '@porteria/database/schema';
import type { DailyReport, WeeklyReport, MonthlyReport, CallStats, EventTimeSeries } from '@porteria/shared';

const db = createDb();

function dayStart(date: string): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayEnd(date: string): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

// ─── Daily Report ────────────────────────────────────────────────────────────

export async function getDailyReport(orgId: string, date?: string): Promise<DailyReport> {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const start = dayStart(targetDate);
  const end = dayEnd(targetDate);

  const [callCounts, doorOpens, callsByHour] = await Promise.all([
    db
      .select({
        status: calls.status,
        count: count(),
      })
      .from(calls)
      .where(
        and(
          eq(calls.organizationId, orgId),
          gte(calls.startedAt, start),
          lte(calls.startedAt, end),
        ),
      )
      .groupBy(calls.status),

    db
      .select({ count: count() })
      .from(events)
      .where(
        and(
          eq(events.organizationId, orgId),
          eq(events.eventType, 'door.open'),
          gte(events.createdAt, start),
          lte(events.createdAt, end),
        ),
      ),

    db.execute<{ hour: number; count: number }>(sql`
      SELECT EXTRACT(HOUR FROM started_at)::int AS hour, COUNT(*)::int AS count
      FROM calls
      WHERE organization_id = ${orgId}::uuid
        AND started_at >= ${start.toISOString()}::timestamptz
        AND started_at < ${new Date(end.getTime() + 86400000).toISOString()}::timestamptz
      GROUP BY hour
      ORDER BY hour
    `),
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
    .where(
      and(
        eq(events.organizationId, orgId),
        gte(events.createdAt, start),
        lte(events.createdAt, end),
      ),
    )
    .groupBy(events.eventType);

  return {
    date: targetDate,
    totalCalls,
    answeredCalls: (statusMap['ended'] || 0) + (statusMap['active'] || 0),
    missedCalls: statusMap['missed'] || 0,
    callsByHour: callsByHour.rows,
    totalDoorOpens: doorOpens[0]?.count ?? 0,
    eventsByType: eventsByType.map((r) => ({ eventType: r.eventType, count: r.count })),
    activeOperators: 0,
  };
}

// ─── Weekly Report ───────────────────────────────────────────────────────────

export async function getWeeklyReport(orgId: string, weekStart?: string): Promise<WeeklyReport> {
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
  let totals = { calls: 0, answered: 0, missed: 0, doors: 0 };

  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(monday);
    dayDate.setDate(monday.getDate() + i);
    const dateStr = dayDate.toISOString().slice(0, 10);
    const start = dayStart(dateStr);
    const end = dayEnd(dateStr);

    const [dayCalls, dayDoors] = await Promise.all([
      db
        .select({ status: calls.status, count: count() })
        .from(calls)
        .where(
          and(
            eq(calls.organizationId, orgId),
            gte(calls.startedAt, start),
            lte(calls.startedAt, end),
          ),
        )
        .groupBy(calls.status),

      db
        .select({ count: count() })
        .from(events)
        .where(
          and(
            eq(events.organizationId, orgId),
            eq(events.eventType, 'door.open'),
            gte(events.createdAt, start),
            lte(events.createdAt, end),
          ),
        ),
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

    days.push({ date: dateStr, totalCalls: dayTotal, answeredCalls: answered, missedCalls: missed, doorOpens: doors });
    totals.calls += dayTotal;
    totals.answered += answered;
    totals.missed += missed;
    totals.doors += doors;
  }

  return { weekStart: monday.toISOString().slice(0, 10), days, totals };
}

// ─── Monthly Report ──────────────────────────────────────────────────────────

export async function getMonthlyReport(orgId: string, month?: string): Promise<MonthlyReport> {
  const target = month || new Date().toISOString().slice(0, 7);
  const [y, m] = target.split('-').map(Number);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);

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

// ─── Call Stats ──────────────────────────────────────────────────────────────

export async function getCallStats(orgId: string, from?: string, to?: string): Promise<CallStats> {
  const defaultFrom = from || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const defaultTo = to || new Date().toISOString().slice(0, 10);
  const start = dayStart(defaultFrom);
  const end = dayEnd(defaultTo);

  const [counts, avgResult, callsByHour, callsByKiosk] = await Promise.all([
    db
      .select({ status: calls.status, count: count() })
      .from(calls)
      .where(
        and(
          eq(calls.organizationId, orgId),
          gte(calls.startedAt, start),
          lte(calls.startedAt, end),
        ),
      )
      .groupBy(calls.status),

    db
      .select({ avgDuration: sqlAvg(calls.duration) })
      .from(calls)
      .where(
        and(
          eq(calls.organizationId, orgId),
          gte(calls.startedAt, start),
          lte(calls.startedAt, end),
        ),
      ),

    db.execute<{ hour: number; count: number }>(sql`
      SELECT EXTRACT(HOUR FROM started_at)::int AS hour, COUNT(*)::int AS count
      FROM calls
      WHERE organization_id = ${orgId}::uuid
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

// ─── Event Breakdown ─────────────────────────────────────────────────────────

export async function getEventBreakdown(
  orgId: string,
  from: string,
  to: string,
  bucket: 'hour' | 'day' = 'day',
): Promise<EventTimeSeries> {
  const start = new Date(from);
  const end = new Date(to);
  const bucketInterval = bucket === 'hour' ? '1 hour' : '1 day';

  const result = await db.execute<{ time: string; event_type: string; count: number }>(sql`
    SELECT
      time_bucket(${bucketInterval}::interval, created_at) AS time,
      event_type,
      COUNT(*)::int AS count
    FROM events
    WHERE organization_id = ${orgId}::uuid
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
