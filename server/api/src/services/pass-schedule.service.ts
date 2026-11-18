import { and, eq, sql } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { accessPasses, communities, passScans } from '@porteria/database/schema';
import {
  isPermanentPass,
  type PassRecurrence,
  type PassRuleSummary,
  type ScanAction,
} from '@porteria/shared';
import type { PassErrorCode } from './pass-errors.js';

const db = createDb();

type AccessPassRow = typeof accessPasses.$inferSelect;

const WEEKDAY_NAMES = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

/**
 * Reads the date and time the way the community lives it.
 *
 * The weekday is derived from the local calendar date instead of the server
 * clock, so a community in another timezone never sees "yesterday" because the
 * process runs in UTC.
 */
export interface LocalDateInfo {
  /** 0 = Sunday, matching `allowed_days`. */
  weekday: number;
  /** Minutes elapsed since local midnight. */
  minutes: number;
}

export async function loadCommunityTimezone(communityId: string): Promise<string> {
  const [row] = await db
    .select({ timezone: communities.timezone })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);
  return row?.timezone ?? 'UTC';
}

export function localDateInfo(now: Date, timezone: string): LocalDateInfo {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  return {
    weekday: new Date(Date.UTC(value('year'), value('month') - 1, value('day'))).getUTCDay(),
    minutes: value('hour') * 60 + value('minute'),
  };
}

export function isAllowedOnDay(pass: AccessPassRow, weekday: number): boolean {
  if (pass.recurrence !== 'weekly') return true;
  return Array.isArray(pass.allowedDays) && pass.allowedDays.includes(weekday);
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

export function isWithinTimeWindow(pass: AccessPassRow, minutes: number): boolean {
  if (!pass.timeFrom || !pass.timeTo) return true;
  return minutes >= timeToMinutes(pass.timeFrom) && minutes <= timeToMinutes(pass.timeTo);
}

/**
 * Counts the uses already consumed **today** by the pass.
 *
 * There is no stored counter on purpose: the source of truth is the confirmed
 * scans, filtered by the community's local date. An entry consumes nothing; for
 * entry+exit passes the use is the completed pair, so the exit is what counts.
 */
export async function countDailyUses(
  pass: AccessPassRow,
  timezone: string,
  now: Date,
): Promise<number> {
  const consumingAction: ScanAction = pass.type === 'entry_only' ? 'entry' : 'exit';
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(passScans)
    .where(
      and(
        eq(passScans.passId, pass.id),
        eq(passScans.status, 'confirmed'),
        eq(passScans.action, consumingAction),
        sql`(${passScans.scannedAt} AT TIME ZONE ${timezone})::date = (${now.toISOString()}::timestamptz AT TIME ZONE ${timezone})::date`,
      ),
    );
  return row?.count ?? 0;
}

/**
 * Answers whether an entry is allowed, from the general rule to the particular
 * one: validity, day, schedule, daily uses. The first failure wins so the guard
 * receives the exact reason instead of a generic denial.
 */
export async function evaluateEntryAccess(
  pass: AccessPassRow,
  now: Date,
  timezone: string,
): Promise<PassErrorCode | null> {
  if (now < pass.validFrom || now > pass.validUntil) return 'not_valid_now';

  const { weekday, minutes } = localDateInfo(now, timezone);
  if (!isAllowedOnDay(pass, weekday)) return 'out_of_days';
  if (!isWithinTimeWindow(pass, minutes)) return 'out_of_schedule';

  const used = await countDailyUses(pass, timezone, now);
  if (used >= pass.maxUses) return 'daily_uses_exhausted';

  return null;
}

/** `DD/MM/YYYY` for the day the community is living when `date` happens. */
function formatLocalDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')}/${value('year')}`;
}

/** `HH:MM` from a stored `time` column, which may carry seconds. */
function formatStoredTime(value: string): string {
  return value.slice(0, 5);
}

/** `Lunes, miércoles y viernes`, capitalised and in Monday-first order. */
function describeDays(days: number[]): string {
  const names = [...new Set(days)]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((day) => WEEKDAY_NAMES[day])
    .filter((name): name is (typeof WEEKDAY_NAMES)[number] => Boolean(name));
  if (names.length === 0) return 'Sin días configurados';

  const [first, ...rest] = names;
  const capitalised = first.charAt(0).toUpperCase() + first.slice(1);
  if (rest.length === 0) return capitalised;
  if (rest.length === 1) return `${capitalised} y ${rest[0]}`;
  return `${capitalised}, ${rest.slice(0, -1).join(', ')} y ${rest.at(-1)}`;
}

/**
 * The static half of the rule: allowed days and daily window. It does not depend
 * on the clock, so it can be frozen into an audit row without lying tomorrow.
 */
export function describeSchedule(pass: AccessPassRow): string {
  const window =
    pass.timeFrom && pass.timeTo
      ? `de ${formatStoredTime(pass.timeFrom)} a ${formatStoredTime(pass.timeTo)}`
      : 'sin horario fijo';

  if (pass.recurrence === 'once') {
    return `Un solo uso · ${window}`;
  }

  const days =
    pass.recurrence === 'weekly' ? describeDays(pass.allowedDays ?? []) : 'Todos los días';
  return `${days} · ${window}`;
}

/**
 * Uses left for the current rule. `once` passes consume in total: their status
 * turns `used` after the last pair, no matter which day it happens. Recurring
 * passes consume per local day, so the counter resets at midnight.
 */
async function remainingUses(pass: AccessPassRow, timezone: string, now: Date): Promise<number> {
  const used =
    pass.recurrence === 'once' && pass.type !== 'entry_only'
      ? pass.exitCount
      : await countDailyUses(pass, timezone, now);
  const limit = pass.type === 'entry_only' ? 1 : pass.maxUses;
  return Math.max(0, limit - used);
}

function describeUses(pass: AccessPassRow, remaining: number): string {
  if (pass.recurrence === 'once') {
    if (remaining === 0) return 'sin usos disponibles';
    return `${remaining} ${remaining === 1 ? 'uso disponible' : 'usos disponibles'} en total`;
  }
  if (remaining === 0) return 'no quedan usos hoy';
  return `quedan ${remaining} ${remaining === 1 ? 'uso' : 'usos'} hoy`;
}

function describeRule(pass: AccessPassRow, timezone: string, remaining: number): string {
  const from = formatLocalDate(pass.validFrom, timezone);
  const until = formatLocalDate(pass.validUntil, timezone);
  const recurrence: PassRecurrence = pass.recurrence;
  const permanent = isPermanentPass(pass.validUntil);

  const modality =
    recurrence === 'weekly'
      ? `${describeDays(pass.allowedDays ?? [])} ${
          permanent ? `desde el ${from} de forma permanente` : `del ${from} al ${until}`
        }`
      : recurrence === 'range'
        ? `Todos los días ${permanent ? `desde el ${from}` : `del ${from} al ${until}`}`
        : `Un solo uso ${permanent ? `desde el ${from}` : `hasta el ${until}`}`;

  const window =
    pass.timeFrom && pass.timeTo
      ? `de ${formatStoredTime(pass.timeFrom)} a ${formatStoredTime(pass.timeTo)}`
      : 'todo el día';

  const entry = pass.type === 'entry_only' ? ' · Sólo entrada' : '';

  return `${modality}, ${window}${entry} · ${describeUses(pass, remaining)}`;
}

/**
 * Human-readable rule plus the numbers the UI needs to show. The guard sees the
 * reason for a denial; the resident and the administration see this summary.
 */
export async function buildPassRule(
  pass: AccessPassRow,
  timezone: string,
  now: Date,
): Promise<PassRuleSummary> {
  const left = await remainingUses(pass, timezone, now);

  return {
    recurrence: pass.recurrence,
    allowedDays: pass.recurrence === 'weekly' ? pass.allowedDays : null,
    timeFrom: pass.timeFrom ? formatStoredTime(pass.timeFrom) : null,
    timeTo: pass.timeTo ? formatStoredTime(pass.timeTo) : null,
    maxUses: pass.maxUses,
    remainingUses: left,
    summary: describeRule(pass, timezone, left),
  };
}
