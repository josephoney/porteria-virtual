/**
 * Helpers para trabajar con fechas `YYYY-MM-DD` en hora local.
 *
 * `new Date('2026-11-23')` se interpreta como UTC, que al oeste de Greenwich
 * cae el día anterior: en Bogotá (UTC-5) eso arrancaba el rango diario un día
 * antes. Estas funciones leen las partes de la fecha y construyen la fecha en
 * la zona local del servidor, que es la que usan los informes.
 */

/** Convierte `YYYY-MM-DD` en la medianoche local de ese día. */
export function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Formatea una fecha como `YYYY-MM-DD` usando sus partes locales. */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Primer instante del día local indicado. */
export function dayStart(date: string): Date {
  const start = parseLocalDate(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Último instante del día local indicado. */
export function dayEnd(date: string): Date {
  const end = parseLocalDate(date);
  end.setHours(23, 59, 59, 999);
  return end;
}
