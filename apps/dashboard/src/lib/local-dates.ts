/**
 * Local dates for the report filters.
 *
 * `toISOString().slice(0, 10)` converts to UTC first, so in Bogotá (UTC-5) any
 * moment after 19:00 reports tomorrow's date and the report opens on the wrong
 * day. Every date the user sees or sends to the API is built from the local
 * parts instead.
 */

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Today as `YYYY-MM-DD` in the browser's time zone. */
export function todayLocalDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Moves a `YYYY-MM-DD` date by whole days, staying in local time. The date is
 * built at noon so a daylight-saving jump never lands on the previous day.
 */
export function shiftLocalDate(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1, 12);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `2026-11-23` → `23/11/2026`. */
export function formatLocalDate(value: string): string {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

/** ISO timestamp → `23/11/2026, 14:05`. */
export function formatLocalDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
