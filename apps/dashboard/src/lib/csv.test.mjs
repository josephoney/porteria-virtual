import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { detectDelimiter, indexHeaders, normalizeHeader, parseCsvTable } from './csv.ts';

describe('CSV parser', () => {
  it('detects commas and semicolons from the header', () => {
    assert.equal(detectDelimiter('nombre,apellido,documento'), ',');
    assert.equal(detectDelimiter('nombre;apellido;documento'), ';');
    assert.equal(detectDelimiter('unidad;correo'), ';');
  });

  it('splits quoted cells and escaped quotes', () => {
    const table = parseCsvTable('nombre,nota\nAna,"Torre ""A"", piso 2"\n');

    assert.deepEqual(table.header, ['nombre', 'nota']);
    assert.deepEqual(table.rows[0]?.cells, ['Ana', 'Torre "A", piso 2']);
  });

  it('removes the BOM and normalizes CRLF line endings', () => {
    const table = parseCsvTable('\uFEFFnombre,apellido\r\nAna,Torres\r\nLuis,Gómez\r\n');

    assert.deepEqual(table.header, ['nombre', 'apellido']);
    assert.deepEqual(
      table.rows.map((row) => row.cells),
      [
        ['Ana', 'Torres'],
        ['Luis', 'Gómez'],
      ],
    );
  });

  it('skips blank lines but keeps their original line numbers', () => {
    const table = parseCsvTable('nombre,apellido\n\nAna,Torres\n\nLuis,Gómez\n');

    assert.deepEqual(
      table.rows.map((row) => row.line),
      [3, 5],
    );
  });

  it('normalizes accented and spaced headers', () => {
    assert.equal(normalizeHeader(' Cédula '), 'cedula');
    assert.equal(normalizeHeader('Acompañantes'), 'acompanantes');

    const columns = indexHeaders(['Nombre', 'Cédula', 'Acompañantes'], {
      nombre: 'firstName',
      cedula: 'document',
      acompanantes: 'companions',
    });

    assert.equal(columns.get('firstName'), 0);
    assert.equal(columns.get('document'), 1);
    assert.equal(columns.get('companions'), 2);
  });
});
