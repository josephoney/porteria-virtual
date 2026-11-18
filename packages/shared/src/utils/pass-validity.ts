/**
 * Technical end date for passes that never expire.
 *
 * `access_passes.valid_until` is `NOT NULL`, and every validity query compares
 * it with `now`. Modelling "permanent" as a far-future instant keeps those
 * queries and indexes intact; a nullable column would force an `IS NULL` branch
 * into every check. Display code must use {@link isPermanentPass} so the
 * sentinel never reaches the user.
 */
export const PERMANENT_PASS_UNTIL = '9999-12-31T23:59:59.999Z';

const PERMANENT_YEAR = 9999;

/** True for the technical "never expires" end date. */
export function isPermanentPass(validUntil: string | Date | null | undefined): boolean {
  if (!validUntil) return false;
  const date = validUntil instanceof Date ? validUntil : new Date(validUntil);
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() >= PERMANENT_YEAR;
}
