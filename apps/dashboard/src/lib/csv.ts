export interface CsvRow {
  /** 1-based line in the original text, header included. */
  line: number;
  cells: string[];
}

export interface CsvTable {
  header: string[];
  rows: CsvRow[];
  delimiter: string;
}

/** Lowercases and strips accents so `Cédula`, `CEDULA` and ` cedula ` all match. */
export function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');
}

/**
 * Excel exports use the list separator of the machine that saved the file.
 * Counting separators in the header is enough to tell comma from semicolon.
 */
export function detectDelimiter(headerLine: string): string {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  return semicolons > commas ? ';' : ',';
}

/** Splits one CSV line, honouring double quotes and escaped quotes. */
export function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/**
 * Parses a CSV file or pasted text. Handles the UTF-8 BOM that Excel adds,
 * CRLF/CR line endings and blank lines. The header is returned separately so
 * callers can map their own columns.
 */
export function parseCsvTable(raw: string): CsvTable {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text
    .split('\n')
    .map((line, index) => ({ line: index + 1, value: line }))
    .filter((line) => line.value.trim().length > 0);

  if (lines.length === 0) return { header: [], rows: [], delimiter: ',' };

  const delimiter = detectDelimiter(lines[0]!.value);
  const header = splitCsvLine(lines[0]!.value, delimiter);
  const rows = lines.slice(1).map((line) => ({
    line: line.line,
    cells: splitCsvLine(line.value, delimiter),
  }));

  return { header, rows, delimiter };
}

/** Maps normalized header names to their column position. */
export function indexHeaders<T extends string>(
  header: string[],
  fields: Record<string, T>,
): Map<T, number> {
  const columns = new Map<T, number>();
  header.forEach((cell, index) => {
    const field = fields[normalizeHeader(cell)];
    if (field && !columns.has(field)) columns.set(field, index);
  });
  return columns;
}
