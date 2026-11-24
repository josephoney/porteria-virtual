import { eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { communities, organizations } from '@porteria/database/schema';
import type { AccessReport, ShiftReport } from '@porteria/shared';
import { getAccessReport, getShiftReport, type ReportsScope } from './reports.service.js';
import type { ReportGranularity } from '@porteria/shared';

const db = createDb();

export type ReportFamily = 'access' | 'shifts';
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

const FAMILIES: ReportFamily[] = ['access', 'shifts'];
const FORMATS: ExportFormat[] = ['csv', 'xlsx', 'pdf'];

export function isReportFamily(value: unknown): value is ReportFamily {
  return typeof value === 'string' && (FAMILIES as string[]).includes(value);
}

export function isExportFormat(value: unknown): value is ExportFormat {
  return typeof value === 'string' && (FORMATS as string[]).includes(value);
}

type Cell = string | number | null;

interface ExportSection {
  heading: string;
  columns: string[];
  rows: Cell[][];
}

/**
 * Documento normalizado del que salen los tres formatos. Si el CSV y el PDF se
 * armaran por caminos distintos podrían decir cosas diferentes y uno estaría
 * mal; por eso todos escriben esta misma estructura.
 */
export interface ExportDocument {
  title: string;
  period: string;
  scope: string;
  sections: ExportSection[];
}

const REPORT_TITLES: Record<ReportFamily, string> = {
  access: 'Reporte de accesos',
  shifts: 'Reporte de turnos',
};

const METHOD_LABELS: Record<string, string> = {
  qr: 'QR',
  document: 'Documento',
};

const SHIFT_STATUS_LABELS: Record<string, string> = {
  open: 'Abierto',
  closed: 'Cerrado',
};

const dateTimeFormatter = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return dateTimeFormatter.format(date);
}

function formatDay(value: string): string {
  // `YYYY-MM` ya viene formateado desde la serie mensual.
  if (value.length === 7) return value;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return dateFormatter.format(new Date(year, month - 1, day));
}

function formatNumber(value: number): string {
  const digits = Number.isInteger(value) ? 0 : 2;
  return value.toLocaleString('es-CO', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Resuelve los nombres del alcance para que el archivo no muestre UUIDs. */
async function describeScope(scope: ReportsScope): Promise<string> {
  const [organization] = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, scope.organizationId))
    .limit(1);

  const parts = [organization?.name ?? scope.organizationId];

  if (scope.communityId) {
    const [community] = await db
      .select({ name: communities.name })
      .from(communities)
      .where(eq(communities.id, scope.communityId))
      .limit(1);
    parts.push(community?.name ?? scope.communityId);
  } else {
    parts.push('Todas las comunidades');
  }

  return parts.join(' · ');
}

function normalizeAccess(report: AccessReport): ExportSection[] {
  const { totals, latency } = report;

  return [
    {
      heading: 'Totales',
      columns: ['Métrica', 'Valor'],
      rows: [
        ['Accesos', totals.total],
        ['Autorizados', totals.authorized],
        ['Denegados', totals.denied],
        ['Fallas de código', totals.codeFailure],
        ['Observaciones', totals.observation],
        ['Ingresos', totals.entries],
        ['Salidas', totals.exits],
      ],
    },
    {
      heading: 'Método de verificación',
      columns: ['Método', 'Accesos'],
      rows: report.byMethod.map((item) => [METHOD_LABELS[item.method] ?? item.method, item.count]),
    },
    {
      heading: 'Accesos por portería',
      columns: ['Portería', 'Accesos'],
      rows: report.byAccessPoint.map((item) => [item.accessPointName, item.count]),
    },
    {
      heading: 'Accesos por hora',
      columns: ['Hora', 'Accesos'],
      rows: report.byHour.map((item) => [`${String(item.hour).padStart(2, '0')}:00`, item.count]),
    },
    {
      heading: 'Motivos de denegación',
      columns: ['Motivo', 'Accesos'],
      rows: report.denialReasons.map((item) => [item.reason, item.count]),
    },
    {
      heading: 'Latencia de confirmación',
      columns: ['Métrica', 'Valor'],
      rows: [
        ['Promedio (segundos)', latency.averageSeconds],
        ['Escaneos QR confirmados', latency.confirmedScans],
        ['Accesos del período', latency.accessCount],
      ],
    },
    {
      heading: 'Serie',
      columns: [
        'Fecha',
        'Accesos',
        'Autorizados',
        'Denegados',
        'Fallas de código',
        'Observaciones',
        'Ingresos',
        'Salidas',
      ],
      rows: report.series.map((point) => [
        formatDay(point.date),
        point.total,
        point.authorized,
        point.denied,
        point.codeFailure,
        point.observation,
        point.entries,
        point.exits,
      ]),
    },
  ];
}

function normalizeShifts(report: ShiftReport): ExportSection[] {
  const { totals } = report;

  return [
    {
      heading: 'Totales',
      columns: ['Métrica', 'Valor'],
      rows: [
        ['Turnos', totals.shifts],
        ['Turnos abiertos', totals.openShifts],
        ['Turnos cerrados', totals.closedShifts],
        ['Horas cumplidas', totals.hours],
        ['Accesos', totals.accesses],
      ],
    },
    {
      heading: 'Horas por guardia',
      columns: ['Guardia', 'Turnos', 'Abiertos', 'Cerrados', 'Horas', 'Accesos'],
      rows: report.guards.map((guard) => [
        guard.guardName,
        guard.shifts,
        guard.openShifts,
        guard.closedShifts,
        guard.hours,
        guard.accesses,
      ]),
    },
    {
      heading: 'Turnos',
      columns: ['Guardia', 'Estado', 'Inicio', 'Fin', 'Horas', 'Accesos'],
      rows: report.shifts.map((shift) => [
        shift.guardName,
        SHIFT_STATUS_LABELS[shift.status] ?? shift.status,
        formatDateTime(shift.startedAt),
        formatDateTime(shift.endedAt),
        shift.hours,
        shift.accesses,
      ]),
    },
    {
      heading: 'Turnos sin cerrar',
      columns: ['Guardia', 'Inicio'],
      rows: report.openShifts.map((shift) => [shift.guardName, formatDateTime(shift.startedAt)]),
    },
  ];
}

function withEmptyRows(sections: ExportSection[]): ExportSection[] {
  return sections.map((section) =>
    section.rows.length > 0 ? section : { ...section, rows: [['Sin registros']] },
  );
}

export async function buildExportDocument(input: {
  report: ReportFamily;
  scope: ReportsScope;
  from: string;
  to: string;
  granularity: ReportGranularity;
}): Promise<ExportDocument> {
  const scopeLabel = await describeScope(input.scope);

  if (input.report === 'access') {
    const report = await getAccessReport(input.scope, input.from, input.to, input.granularity);
    return {
      title: REPORT_TITLES.access,
      period: `${formatDay(input.from)} — ${formatDay(input.to)}`,
      scope: scopeLabel,
      sections: withEmptyRows(normalizeAccess(report)),
    };
  }

  const report = await getShiftReport(input.scope, input.from, input.to);
  return {
    title: REPORT_TITLES.shifts,
    period: `${formatDay(input.from)} — ${formatDay(input.to)}`,
    scope: scopeLabel,
    sections: withEmptyRows(normalizeShifts(report)),
  };
}

/* ------------------------------------------------------------------ CSV */

function csvCell(value: Cell): string {
  if (value === null) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvLine(values: Cell[]): string {
  return values.map(csvCell).join(',');
}

export function renderCsv(document: ExportDocument): Buffer {
  const lines: string[] = [
    csvLine([document.title]),
    csvLine(['Período', document.period]),
    csvLine(['Alcance', document.scope]),
  ];

  for (const section of document.sections) {
    lines.push('');
    lines.push(csvLine([section.heading]));
    lines.push(csvLine(section.columns));
    for (const row of section.rows) lines.push(csvLine(row));
  }

  // BOM UTF-8 para que Excel abra los acentos correctamente.
  return Buffer.from(`\uFEFF${lines.join('\r\n')}\r\n`, 'utf8');
}

/* ----------------------------------------------------------------- XLSX */

function sheetName(heading: string, used: Set<string>): string {
  const base = heading.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || 'Hoja';
  let name = base;
  let suffix = 2;
  while (used.has(name)) {
    const extra = ` ${suffix++}`;
    name = `${base.slice(0, 31 - extra.length)}${extra}`;
  }
  used.add(name);
  return name;
}

export async function renderXlsx(document: ExportDocument): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Portería Virtual';
  workbook.created = new Date();

  const used = new Set<string>();

  document.sections.forEach((section, index) => {
    const sheet = workbook.addWorksheet(sheetName(`${index + 1} ${section.heading}`, used));
    const lastColumn = section.columns.length;

    if (index === 0) {
      const titleRow = sheet.addRow([document.title]);
      titleRow.font = { bold: true, size: 14 };
      sheet.addRow(['Período', document.period]);
      sheet.addRow(['Alcance', document.scope]);
      sheet.addRow([]);
    }

    const headerRow = sheet.addRow(section.columns);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.border = { bottom: { style: 'thin' } };
    });

    for (const row of section.rows) sheet.addRow(row);

    for (let column = 1; column <= lastColumn; column += 1) {
      const width = Math.min(
        48,
        Math.max(
          12,
          ...section.columns.slice(column - 1, column).map((c) => c.length + 4),
          ...section.rows.map((row) => String(row[column - 1] ?? '').length + 2),
        ),
      );
      sheet.getColumn(column).width = width;
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}

/* ------------------------------------------------------------------ PDF */

const PDF_COLORS = {
  ink: '#111827',
  muted: '#6b7280',
  rule: '#d1d5db',
  header: '#f3f4f6',
};

/**
 * Escribe una tabla con encabezado repetido al cortar de página. Nunca deja una
 * fila desbordada: cuando no cabe, abre página nueva.
 */
function drawTable(
  doc: PDFKit.PDFDocument,
  section: ExportSection,
  startY: number,
  margin: number,
  usableWidth: number,
): number {
  const rowHeight = 18;
  const bottom = doc.page.height - margin - 24;
  const columnWidth = usableWidth / Math.max(section.columns.length, 1);
  let y = startY;

  const drawHeader = () => {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(PDF_COLORS.ink);
    doc
      .rect(margin, y - 4, usableWidth, rowHeight)
      .fillColor(PDF_COLORS.header)
      .fill();
    doc.fillColor(PDF_COLORS.ink);
    section.columns.forEach((column, index) => {
      doc.text(column, margin + index * columnWidth + 4, y, {
        width: columnWidth - 8,
        height: rowHeight,
        ellipsis: true,
      });
    });
    y += rowHeight;
  };

  drawHeader();

  doc.font('Helvetica').fontSize(9).fillColor(PDF_COLORS.ink);

  for (const row of section.rows) {
    if (y + rowHeight > bottom) {
      doc.addPage();
      y = margin;
      drawHeader();
      doc.font('Helvetica').fontSize(9).fillColor(PDF_COLORS.ink);
    }
    row.forEach((value, index) => {
      const text =
        value === null ? '—' : typeof value === 'number' ? formatNumber(value) : String(value);
      doc.text(text, margin + index * columnWidth + 4, y, {
        width: columnWidth - 8,
        height: rowHeight,
        ellipsis: true,
      });
    });
    y += rowHeight;
  }

  return y + 10;
}

export async function renderPdf(document: ExportDocument): Promise<Buffer> {
  const PDFDocument = (await import('pdfkit')).default;
  const margin = 40;
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin });

  const chunks: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const usableWidth = doc.page.width - margin * 2;

  doc.font('Helvetica-Bold').fontSize(18).fillColor(PDF_COLORS.ink).text(document.title);
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor(PDF_COLORS.muted);
  doc.text(`Período: ${document.period}`);
  doc.text(`Alcance: ${document.scope}`);
  doc.text(`Generado: ${dateTimeFormatter.format(new Date())}`);
  doc.moveDown(0.6);

  let y = doc.y + 4;

  for (const section of document.sections) {
    if (y + 60 > doc.page.height - margin - 24) {
      doc.addPage();
      y = margin;
    }
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .fillColor(PDF_COLORS.ink)
      .text(section.heading, margin, y);
    y = doc.y + 6;
    y = drawTable(doc, section, y, margin, usableWidth);
    y += 6;
  }

  doc.end();
  return finished;
}

/* ------------------------------------------------------------ Despacho */

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

const EXTENSIONS: Record<ExportFormat, string> = {
  csv: 'csv',
  xlsx: 'xlsx',
  pdf: 'pdf',
};

export async function buildExportFile(input: {
  report: ReportFamily;
  format: ExportFormat;
  scope: ReportsScope;
  from: string;
  to: string;
  granularity: ReportGranularity;
}): Promise<{ body: Buffer; contentType: string; filename: string }> {
  const document = await buildExportDocument(input);

  let body: Buffer;
  if (input.format === 'csv') body = renderCsv(document);
  else if (input.format === 'xlsx') body = await renderXlsx(document);
  else body = await renderPdf(document);

  const base = input.report === 'access' ? 'accesos' : 'turnos';

  return {
    body,
    contentType: CONTENT_TYPES[input.format],
    filename: `${base}-${input.from}-${input.to}.${EXTENSIONS[input.format]}`,
  };
}
