import { and, asc, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { createDb } from '@porteria/database';
import {
  accessPasses,
  bitacoraEntries,
  organizations,
  passScans,
  retentionHolds,
  retentionRuns,
} from '@porteria/database/schema';

const db = createDb();

/** Placeholder that replaces the identity once a record leaves the window. */
export const ANONYMIZED_NAME = 'Anonimizado';
export const ANONYMIZED_DOCUMENT = 'ANONIMIZADO';
/** Generic summary for an entry whose free text carried the visitor's name. */
export const ANONYMIZED_SUMMARY = 'Acceso anonimizado';

/**
 * Windows the administration can choose between.
 *
 * The window is short on purpose: it has to be long enough to answer "who
 * entered last month" and short enough to be a retention policy and not an
 * archive. Thirty days is the default; ninety is the ceiling.
 */
export const RETENTION_DAYS_OPTIONS = [30, 60, 90] as const;
export const RETENTION_DEFAULT_DAYS = 30;

export interface RetentionOutcome {
  organizationId: string;
  retentionDays: number;
  dryRun: boolean;
  /** Last instant still inside the window; everything older is anonymized. */
  cutoff: string;
  passes: number;
  scans: number;
  entries: number;
  /** Rows old enough to anonymize but covered by an active legal hold. */
  preserved: number;
}

export interface RetentionOptions {
  /** Counts only: nothing is written to the access record. */
  dryRun: boolean;
}

export function isRetentionWindow(value: number): boolean {
  return (RETENTION_DAYS_OPTIONS as readonly number[]).includes(value);
}

/** Cutoff for a window in days. */
export function retentionCutoff(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/** Filter for the rows of an organization, which owns the communities. */
function belongsToOrganization(column: AnyPgColumn, organizationId: string) {
  return sql`${column} IN (SELECT id FROM communities WHERE organization_id = ${organizationId})`;
}

/**
 * Records that still carry the identity of the visitor.
 *
 * The update filters on the placeholder so a second run counts zero instead of
 * rewriting the same rows forever.
 */
function stillIdentified(column: AnyPgColumn) {
  return sql`${column} <> ${ANONYMIZED_DOCUMENT}`;
}

/**
 * Rows covered by an active hold of the organization.
 *
 * A hold preserves a date range on purpose: an incident, an investigation or a
 * judicial request. It is a decision of the administration, it has a reason and
 * an expiration, and while it is active the sweep leaves those rows alone.
 */
function notHeld(organizationId: string, communityColumn: AnyPgColumn, atColumn: AnyPgColumn) {
  return sql`NOT EXISTS (
    SELECT 1 FROM retention_holds h
    WHERE h.organization_id = ${organizationId}
      AND (h.community_id IS NULL OR h.community_id = ${communityColumn})
      AND ${atColumn} >= h.from_date
      AND ${atColumn} < (h.to_date + INTERVAL '1 day')
      AND h.released_at IS NULL
      AND (h.expires_at IS NULL OR h.expires_at > now())
  )`;
}

/** Summary replaced only when it repeats the visitor's first name. */
const anonymizedSummary = sql`CASE
  WHEN ${bitacoraEntries.details} -> 'visitor' ->> 'firstName' IS NOT NULL
   AND summary LIKE '%' || (${bitacoraEntries.details} -> 'visitor' ->> 'firstName') || '%'
  THEN ${ANONYMIZED_SUMMARY}
  ELSE summary
END`;

/**
 * Anonymizes visitor identity older than the organization's window.
 *
 * The record itself stays: type, result, reason, time, access point, shift and
 * the authorizer are what the reports and the readable board read, and none of
 * them is the visitor's personal data. Deleting the row would erase the
 * operation; replacing the identity preserves the count and removes the person.
 */
export async function anonymizeOrganization(
  organizationId: string,
  days: number,
  options: RetentionOptions,
): Promise<RetentionOutcome> {
  if (!isRetentionWindow(days)) {
    throw new Error(`Retention window must be one of ${RETENTION_DAYS_OPTIONS.join(', ')} days`);
  }

  const cutoff = retentionCutoff(days);

  const outcome = await db.transaction(async (tx) => {
    const passesWhere = and(
      belongsToOrganization(accessPasses.communityId, organizationId),
      lt(accessPasses.validUntil, cutoff),
      stillIdentified(accessPasses.visitorDocument),
    );

    const scansWhere = and(
      belongsToOrganization(passScans.communityId, organizationId),
      lt(passScans.scannedAt, cutoff),
      stillIdentified(passScans.visitorDocument),
    );

    // El autorizador no se anonimiza: no es el visitante. La identidad que se
    // borra vive sólo en el detalle que describe a quien entró.
    const entriesIdentity = sql`(
      ${bitacoraEntries.details} ? 'visitor'
      OR ${bitacoraEntries.details} ? 'companions'
      OR ${bitacoraEntries.details} ? 'vehiclePlate'
    )`;

    const entriesWhere = and(
      belongsToOrganization(bitacoraEntries.communityId, organizationId),
      lt(bitacoraEntries.createdAt, cutoff),
      entriesIdentity,
    );

    const passesHeld = notHeld(organizationId, accessPasses.communityId, accessPasses.validUntil);
    const scansHeld = notHeld(organizationId, passScans.communityId, passScans.scannedAt);
    const entriesHeld = notHeld(
      organizationId,
      bitacoraEntries.communityId,
      bitacoraEntries.createdAt,
    );

    const [passes] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(accessPasses)
      .where(and(passesWhere, passesHeld));
    const [scans] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(passScans)
      .where(and(scansWhere, scansHeld));
    const [entries] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(bitacoraEntries)
      .where(and(entriesWhere, entriesHeld));

    const [heldPasses] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(accessPasses)
      .where(and(passesWhere, sql`NOT (${passesHeld})`));
    const [heldScans] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(passScans)
      .where(and(scansWhere, sql`NOT (${scansHeld})`));
    const [heldEntries] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(bitacoraEntries)
      .where(and(entriesWhere, sql`NOT (${entriesHeld})`));

    const counts = {
      passes: Number(passes?.count ?? 0),
      scans: Number(scans?.count ?? 0),
      entries: Number(entries?.count ?? 0),
    };
    const preserved =
      Number(heldPasses?.count ?? 0) +
      Number(heldScans?.count ?? 0) +
      Number(heldEntries?.count ?? 0);

    if (!options.dryRun) {
      if (counts.passes > 0) {
        await tx
          .update(accessPasses)
          .set({
            visitorFirstName: ANONYMIZED_NAME,
            visitorLastName: '',
            visitorDocument: ANONYMIZED_DOCUMENT,
            companions: [],
            vehiclePlate: null,
            hasVehicle: false,
          })
          .where(and(passesWhere, passesHeld));
      }

      if (counts.scans > 0) {
        await tx
          .update(passScans)
          .set({
            visitorFirstName: ANONYMIZED_NAME,
            visitorLastName: '',
            visitorDocument: ANONYMIZED_DOCUMENT,
            vehiclePlate: null,
          })
          .where(and(scansWhere, scansHeld));
      }

      if (counts.entries > 0) {
        await tx
          .update(bitacoraEntries)
          .set({
            summary: anonymizedSummary,
            details: sql`(
              ${bitacoraEntries.details} - 'visitor' - 'companions' - 'vehiclePlate'
            )`,
          })
          .where(and(entriesWhere, entriesHeld));
      }
    }

    return { ...counts, preserved };
  });

  await db.insert(retentionRuns).values({
    organizationId,
    retentionDays: days,
    dryRun: options.dryRun,
    anonymizedPasses: outcome.passes,
    anonymizedScans: outcome.scans,
    anonymizedEntries: outcome.entries,
  });

  return {
    organizationId,
    retentionDays: days,
    dryRun: options.dryRun,
    cutoff: cutoff.toISOString(),
    ...outcome,
  };
}

/** Runs the window of every organization. Used by the scheduled worker. */
export async function anonymizeAllOrganizations(
  options: RetentionOptions,
): Promise<RetentionOutcome[]> {
  const rows = await db
    .select({ id: organizations.id, days: organizations.retentionDays })
    .from(organizations)
    .orderBy(asc(organizations.name));

  const outcomes: RetentionOutcome[] = [];
  for (const row of rows) {
    try {
      outcomes.push(await anonymizeOrganization(row.id, row.days, options));
    } catch (error) {
      console.error(`Retention: organization ${row.id} failed`, error);
    }
  }
  return outcomes;
}

/** Recent runs of an organization, newest first. */
export async function listRetentionRuns(organizationId: string, limit = 20) {
  return db
    .select()
    .from(retentionRuns)
    .where(eq(retentionRuns.organizationId, organizationId))
    .orderBy(desc(retentionRuns.ranAt))
    .limit(limit);
}

/** Holds of an organization: the active ones first, then the latest created. */
export async function listRetentionHolds(organizationId: string, limit = 50) {
  return db
    .select()
    .from(retentionHolds)
    .where(eq(retentionHolds.organizationId, organizationId))
    .orderBy(
      desc(
        sql`(${retentionHolds.releasedAt} IS NULL AND (${retentionHolds.expiresAt} IS NULL OR ${retentionHolds.expiresAt} > now()))`,
      ),
      desc(retentionHolds.createdAt),
    )
    .limit(limit);
}

export interface RetentionHoldInput {
  organizationId: string;
  communityId: string | null;
  fromDate: string;
  toDate: string;
  reason: string;
  createdByPersonId: string | null;
  /** Obligatorio: una preservación sin fin sería retención indefinida. */
  expiresAt: Date;
}

/**
 * Creates a hold over a date range.
 *
 * Without a hold an incident older than the window cannot be investigated: the
 * identity is already gone. The hold is the documented exception, with an
 * author, a reason and an expiration.
 */
export async function createRetentionHold(input: RetentionHoldInput) {
  const [hold] = await db.insert(retentionHolds).values(input).returning();
  return hold;
}

/** Releases a hold so the sweep can anonymize its range again. */
export async function releaseRetentionHold(
  organizationId: string,
  holdId: string,
  releasedByPersonId: string | null,
) {
  const [hold] = await db
    .update(retentionHolds)
    .set({ releasedAt: new Date(), releasedByPersonId })
    .where(
      and(
        eq(retentionHolds.id, holdId),
        eq(retentionHolds.organizationId, organizationId),
        isNull(retentionHolds.releasedAt),
      ),
    )
    .returning();
  return hold ?? null;
}

/** Active holds of an organization, for display and diagnostics. */
export async function listActiveRetentionHolds(organizationId: string) {
  return db
    .select()
    .from(retentionHolds)
    .where(
      and(
        eq(retentionHolds.organizationId, organizationId),
        isNull(retentionHolds.releasedAt),
        or(isNull(retentionHolds.expiresAt), sql`${retentionHolds.expiresAt} > now()`),
      ),
    )
    .orderBy(asc(retentionHolds.fromDate));
}
