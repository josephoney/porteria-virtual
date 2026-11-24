import { anonymizeAllOrganizations } from '../services/retention.service.js';

/** Data retention is a daily job; an hour of drift does not matter. */
const INTERVAL_MS =
  Math.max(1, parseInt(process.env.RETENTION_INTERVAL_MINUTES || '1440', 10)) * 60_000;

/**
 * Writing is off unless it is asked for.
 *
 * A scheduled job that anonymizes on its first run, in an environment nobody
 * configured, destroys data that cannot be recovered. The sweep therefore
 * records what it would have anonymized until `RETENTION_WRITE_ENABLED` says
 * otherwise.
 */
export function retentionWritesEnabled() {
  return process.env.RETENTION_WRITE_ENABLED === 'true';
}

export async function sweepRetention() {
  const dryRun = !retentionWritesEnabled();
  const outcomes = await anonymizeAllOrganizations({ dryRun });

  const totals = outcomes.reduce(
    (acc, outcome) => ({
      passes: acc.passes + outcome.passes,
      scans: acc.scans + outcome.scans,
      entries: acc.entries + outcome.entries,
      preserved: acc.preserved + outcome.preserved,
    }),
    { passes: 0, scans: 0, entries: 0, preserved: 0 },
  );

  // The per-organization rows are already stored; this is the operator's line.
  console.log(
    `[retention] ${dryRun ? 'dry run' : 'applied'}: ` +
      `${outcomes.length} organization(s), ${totals.passes} pass(es), ` +
      `${totals.scans} scan(s), ${totals.entries} bitacora entry(ies), ` +
      `${totals.preserved} row(s) kept by an active hold`,
  );
}

let timer: NodeJS.Timeout | null = null;

export function startRetentionWorker() {
  if (process.env.RETENTION_WORKER_ENABLED === 'false') return;

  const run = async () => {
    try {
      await sweepRetention();
    } catch (error) {
      console.error('[retention] sweep failed', error);
    }
  };

  // The first run waits for the interval instead of firing at boot: a restart
  // loop must not multiply a job that rewrites the access record.
  timer = setInterval(run, INTERVAL_MS);
  // This loop should not keep the process alive on its own.
  timer.unref?.();
}

export function stopRetentionWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
