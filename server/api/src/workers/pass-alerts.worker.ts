import { and, eq, lt, ne } from 'drizzle-orm';

import { createDb } from '@porteria/database';
import { accessPasses, passAlerts } from '@porteria/database/schema';

import config from '../config.js';

const db = createDb();

/** How often the sweep runs. Short enough to catch a night visit, free enough to ignore. */
const INTERVAL_MS =
  Math.max(1, parseInt(process.env.PASS_ALERT_INTERVAL_MINUTES || '5', 10)) * 60_000;

/**
 * Flags the visitors who stayed inside past their window.
 *
 * The table and the `missing_exit` type already existed and the exit resolved
 * them, but nothing created one: a visitor who never left simply disappeared
 * from the record.
 *
 * The alert is persisted instead of computed on read so it leaves a trace of
 * when the absence was detected, and the board can show the badge even after the
 * visitor eventually leaves.
 */
export async function sweepPassAlerts() {
  const graceMinutes = config.passes.missingExitGraceMinutes;
  const limit = new Date(Date.now() - graceMinutes * 60_000);

  const overdue = await db
    .select({
      id: accessPasses.id,
      communityId: accessPasses.communityId,
      validUntil: accessPasses.validUntil,
    })
    .from(accessPasses)
    .where(
      and(
        eq(accessPasses.presenceState, 'inside'),
        lt(accessPasses.validUntil, limit),
        ne(accessPasses.status, 'revoked'),
      ),
    )
    .limit(200);

  for (const pass of overdue) {
    const [existing] = await db
      .select({ id: passAlerts.id })
      .from(passAlerts)
      .where(and(eq(passAlerts.passId, pass.id), eq(passAlerts.status, 'open')))
      .limit(1);
    if (existing) continue;

    try {
      await db.insert(passAlerts).values({
        passId: pass.id,
        communityId: pass.communityId,
        type: 'missing_exit',
        status: 'open',
        dueAt: pass.validUntil,
      });
    } catch {
      // The partial unique index on open alerts wins a race with another sweep.
    }
  }
}

let timer: NodeJS.Timeout | null = null;

export function startPassAlertsWorker() {
  if (process.env.PASS_ALERT_WORKER_ENABLED === 'false') return;

  const run = async () => {
    try {
      await sweepPassAlerts();
    } catch (error) {
      console.error('[pass-alerts] sweep failed', error);
    }
  };

  void run();
  timer = setInterval(run, INTERVAL_MS);
  // This loop should not keep the process alive on its own.
  timer.unref?.();
}

export function stopPassAlertsWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
