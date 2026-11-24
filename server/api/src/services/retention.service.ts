import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

import { createDb } from '@porteria/database';
import {
  accessPasses,
  bitacoraEntries,
  organizations,
  passScans,
  retentionRuns,
} from '@porteria/database/schema';

const db = createDb();

/** Placeholder that replaces the identity once a record leaves the window. */
export const ANONYMIZED_NAME = 'Anonimizado';
export const ANONYMIZED_DOCUMENT = 'ANONIMIZADO';

export const RETENTION_MIN_MONTHS = 1;
export const RETENTION_MAX_MONTHS = 60;
export const RETENTION_DEFAULT_MONTHS = 12;

export interface RetentionOutcome {
  organizationId: string;
  retentionMonths: number;
  dryRun: boolean;
  /** Last instant still inside the window; everything older is anonymized. */
  cutoff: string;
  passes: number;
  scans: number;
  entries: number;
}

export interface RetentionOptions {
  /** Counts only: nothing is written to the access record. */
  dryRun: boolean;
}

/**
 * Cutoff for a window in months, keeping the day of the month when it exists.
 *
 * `setMonth` alone turns 31 March into 3 March when February is shorter, so the
 * day is clamped to the last valid day of the target month.
 */
export function retentionCutoff(months: number, now: Date = new Date()): Date {
  const cutoff = new Date(now.getTime());
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const lastDay = new Date(
    Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0),
  ).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return cutoff;
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
 * Anonymizes visitor identity older than the organization's window.
 *
 * The record itself stays: type, result, reason, time, access point, shift and
 * pass are what the reports and the readable board read, and none of them is
 * personal data. Deleting the row would erase the operation; replacing the
 * identity preserves the count and removes the person.
 */
export async function anonymizeOrganization(
  organizationId: string,
  months: number,
  options: RetentionOptions,
): Promise<RetentionOutcome> {
  const cutoff = retentionCutoff(months);

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

    const entriesWhere = and(
      belongsToOrganization(bitacoraEntries.communityId, organizationId),
      lt(bitacoraEntries.createdAt, cutoff),
      sql`(
        ${bitacoraEntries.authorizedByName} IS NOT NULL
        OR ${bitacoraEntries.details} ? 'visitor'
        OR ${bitacoraEntries.details} ? 'companions'
        OR ${bitacoraEntries.details} ? 'vehiclePlate'
        OR ${bitacoraEntries.details} ? 'authorizedByName'
      )`,
    );

    const [passes] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(accessPasses)
      .where(passesWhere);
    const [scans] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(passScans)
      .where(scansWhere);
    const [entries] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(bitacoraEntries)
      .where(entriesWhere);

    const counts = {
      passes: Number(passes?.count ?? 0),
      scans: Number(scans?.count ?? 0),
      entries: Number(entries?.count ?? 0),
    };

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
          .where(passesWhere);
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
          .where(scansWhere);
      }

      if (counts.entries > 0) {
        await tx
          .update(bitacoraEntries)
          .set({
            authorizedByName: null,
            details: sql`(
              ${bitacoraEntries.details}
              - 'visitor' - 'companions' - 'vehiclePlate' - 'authorizedByName'
            )`,
          })
          .where(entriesWhere);
      }
    }

    return counts;
  });

  await db.insert(retentionRuns).values({
    organizationId,
    retentionMonths: months,
    dryRun: options.dryRun,
    anonymizedPasses: outcome.passes,
    anonymizedScans: outcome.scans,
    anonymizedEntries: outcome.entries,
  });

  return {
    organizationId,
    retentionMonths: months,
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
    .select({ id: organizations.id, months: organizations.retentionMonths })
    .from(organizations)
    .orderBy(asc(organizations.name));

  const outcomes: RetentionOutcome[] = [];
  for (const row of rows) {
    outcomes.push(await anonymizeOrganization(row.id, row.months, options));
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
