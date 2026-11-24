import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { dayEnd, dayStart, parseLocalDate, toLocalDateString } from '../src/lib/report-dates.js';

describe('report dates', () => {
  it('parses a date as local midnight and not as UTC', () => {
    const parsed = parseLocalDate('2026-11-23');

    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 10);
    assert.equal(parsed.getDate(), 23);
    assert.equal(parsed.getHours(), 0);
    assert.equal(parsed.getMinutes(), 0);
    assert.equal(parsed.getSeconds(), 0);
  });

  it('reads the date parts instead of the UTC instant', () => {
    // El error original era `new Date('2026-11-23')`, que al oeste de Greenwich
    // resuelve el día anterior. Comparar contra la fecha local construida con
    // sus partes deja claro cuál es el contrato.
    const parsed = parseLocalDate('2026-11-23');

    assert.equal(parsed.getTime(), new Date(2026, 10, 23).getTime());
  });

  it('round-trips every date without shifting a day', () => {
    const dates = ['2026-01-01', '2026-02-28', '2026-06-15', '2026-11-23', '2026-12-31'];

    for (const date of dates) {
      assert.equal(toLocalDateString(parseLocalDate(date)), date);
    }
  });

  it('formats a date near midnight with local parts', () => {
    const lateEvening = new Date(2026, 10, 23, 23, 30, 0);

    assert.equal(toLocalDateString(lateEvening), '2026-11-23');
  });

  it('covers the whole local day', () => {
    const start = dayStart('2026-11-23');
    const end = dayEnd('2026-11-23');

    assert.equal(start.getDate(), 23);
    assert.equal(start.getHours(), 0);
    assert.equal(start.getMinutes(), 0);
    assert.equal(start.getSeconds(), 0);
    assert.equal(start.getMilliseconds(), 0);

    assert.equal(end.getDate(), 23);
    assert.equal(end.getHours(), 23);
    assert.equal(end.getMinutes(), 59);
    assert.equal(end.getSeconds(), 59);
    assert.equal(end.getMilliseconds(), 999);

    assert.equal(end.getTime() - start.getTime(), 86_400_000 - 1);
  });
});
