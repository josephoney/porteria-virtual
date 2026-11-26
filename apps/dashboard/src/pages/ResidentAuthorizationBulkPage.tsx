import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  RiDownloadLine,
  RiFileList3Line,
  RiFileUploadLine,
  RiUploadCloud2Line,
} from '@remixicon/react';
import type { PassBatchResult, PassCompanion } from '@porteria/shared';
import { ApiError, get, post } from '../lib/apiClient';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { PageHeader } from '../components/layout/PageHeader';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Skeleton } from '../components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

const MAX_VISITORS = 200;
const MAX_COMPANIONS = 10;

const TEMPLATE_CSV =
  'nombre,apellido,documento,placa,acompañantes\nAna,Torres,10203040,,Ana Pérez|123456;Luis Gómez|789012\nLuis,Gómez,55667788,ABC123,\n';

type PassTypeValue = 'entry_only' | 'entry_exit';

interface Destination {
  id: string;
  name: string;
  path: string;
  kind: 'home' | 'common_area';
}

interface CsvRow {
  /** 1-based line in the original file, header included. */
  line: number;
  firstName: string;
  lastName: string;
  document: string;
  plate: string;
  companions: PassCompanion[];
  /** Row-level problem with the `companions` cell, if any. */
  companionsError: string | null;
}

interface ParsedCsv {
  rows: CsvRow[];
  /** The file cannot be used at all (missing headers). */
  error: string | null;
  /** The file has more rows than the API accepts. */
  limitError: string | null;
}

interface PreviewRow extends CsvRow {
  /** `null` means the row can be sent to the API. */
  reason: string | null;
}

interface BatchVisitor {
  firstName: string;
  lastName: string;
  document: string;
  vehiclePlate: string | null;
  companions?: PassCompanion[];
}

interface BatchPreviewResponse {
  batchLabel: string | null;
  total: number;
  validCount: number;
  rejected: Array<{
    document: string;
    visitorFirstName: string;
    visitorLastName: string;
    reason: string;
  }>;
}

const HEADER_FIELDS: Record<
  string,
  'firstName' | 'lastName' | 'document' | 'plate' | 'companions'
> = {
  nombre: 'firstName',
  nombres: 'firstName',
  apellido: 'lastName',
  apellidos: 'lastName',
  documento: 'document',
  documentos: 'document',
  doc: 'document',
  cedula: 'document',
  placa: 'plate',
  placas: 'plate',
  patente: 'plate',
  acompanantes: 'companions',
  companions: 'companions',
  acompanante: 'companions',
};

const FIELD_LABELS: Record<'firstName' | 'lastName' | 'document', string> = {
  firstName: 'nombre',
  lastName: 'apellido',
  document: 'documento',
};

/** Lowercases and strips accents so `Cédula`, `CEDULA` and ` cedula ` all match. */
function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '');
}

function normalizeDocument(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Bulk format: `Nombre Apellido|Documento;Otro Nombre|Documento`. A single
 * readable cell is easier to edit in Excel than embedded JSON, and a malformed
 * cell becomes a row-level error instead of a broken pass.
 */
function parseCompanions(raw: string): { companions: PassCompanion[]; error: string | null } {
  const value = raw.trim();
  if (!value) return { companions: [], error: null };

  // A trailing separator is a natural Excel artifact: it is trimmed away
  // instead of turning the whole row invalid.
  const parts = value
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > MAX_COMPANIONS) {
    return { companions: [], error: `Máximo ${MAX_COMPANIONS} acompañantes por fila.` };
  }

  const companions: PassCompanion[] = [];
  const documents = new Set<string>();

  for (const [index, part] of parts.entries()) {
    const [name = '', document = '', ...rest] = part.split('|').map((cell) => cell.trim());
    const nameParts = name.split(/\s+/).filter(Boolean);

    if (!name || !document || rest.length > 0 || nameParts.length < 2) {
      return {
        companions: [],
        error: `Acompañante ${index + 1}: usa el formato "Nombre Apellido|Documento".`,
      };
    }

    const key = normalizeDocument(document);
    if (documents.has(key)) {
      return {
        companions: [],
        error: `El documento ${document} está repetido entre los acompañantes.`,
      };
    }
    documents.add(key);

    companions.push({
      firstName: nameParts.slice(0, -1).join(' '),
      lastName: nameParts[nameParts.length - 1]!,
      document,
    });
  }

  return { companions, error: null };
}

/** Splits one CSV line, honouring double quotes and escaped quotes. */
function splitLine(line: string, delimiter: string): string[] {
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

function parseCsv(raw: string): ParsedCsv {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) return { rows: [], error: null, limitError: null };

  const headerLine = lines[0];
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semicolons = (headerLine.match(/;/g) ?? []).length;
  const delimiter = semicolons > commas ? ';' : ',';

  const columns = new Map<string, number>();
  splitLine(headerLine, delimiter).forEach((cell, index) => {
    const field = HEADER_FIELDS[normalizeHeader(cell)];
    if (field && !columns.has(field)) columns.set(field, index);
  });

  const missing = (['firstName', 'lastName', 'document'] as const).filter(
    (field) => !columns.has(field),
  );

  if (missing.length > 0) {
    const labels = missing.map((field) => FIELD_LABELS[field]).join(', ');
    return {
      rows: [],
      error: `Faltan las columnas: ${labels}. La plantilla trae nombre, apellido, documento y placa.`,
      limitError: null,
    };
  }

  const rows = lines.slice(1).map((line, index) => {
    const cells = splitLine(line, delimiter);
    const read = (field: string) => {
      const position = columns.get(field);
      return position === undefined ? '' : (cells[position] ?? '').trim();
    };
    const parsedCompanions = parseCompanions(read('companions'));

    return {
      line: index + 2,
      firstName: read('firstName'),
      lastName: read('lastName'),
      document: read('document'),
      plate: read('plate'),
      companions: parsedCompanions.companions,
      companionsError: parsedCompanions.error,
    };
  });

  if (rows.length > MAX_VISITORS) {
    return {
      rows,
      error: null,
      limitError: `El archivo tiene ${rows.length} filas y el máximo es ${MAX_VISITORS}.`,
    };
  }

  return { rows, error: null, limitError: null };
}

function missingProblem(row: CsvRow): string | null {
  const missing = [
    row.firstName ? null : 'nombre',
    row.lastName ? null : 'apellido',
    row.document ? null : 'documento',
  ].filter((value): value is string => value !== null);

  if (missing.length === 0) return null;
  if (missing.length === 1) return `Falta el ${missing[0]}.`;
  return `Faltan ${missing.slice(0, -1).join(', ')} y ${missing[missing.length - 1]}.`;
}

/**
 * Rows the API will actually receive: no missing fields and no repeated
 * document. Detecting duplicates here keeps each rejection from the server
 * mapped to exactly one row, because every document that reaches the API is
 * unique inside the file.
 */
function selectVisitors(rows: CsvRow[]): BatchVisitor[] {
  const seen = new Set<string>();
  const visitors: BatchVisitor[] = [];

  for (const row of rows) {
    if (missingProblem(row) || row.companionsError) continue;

    const key = normalizeDocument(row.document);
    if (seen.has(key)) continue;
    seen.add(key);

    visitors.push({
      firstName: row.firstName,
      lastName: row.lastName,
      document: row.document,
      vehiclePlate: row.plate ? row.plate.toUpperCase() : null,
      ...(row.companions.length > 0 ? { companions: row.companions } : {}),
    });
  }

  return visitors;
}

function buildPreviewRows(
  rows: CsvRow[],
  rejected: BatchPreviewResponse['rejected'],
): PreviewRow[] {
  const reasons = new Map<string, string>();
  for (const rejection of rejected) {
    const key = normalizeDocument(rejection.document);
    if (!reasons.has(key)) reasons.set(key, rejection.reason);
  }

  const seen = new Set<string>();

  return rows.map((row) => {
    const problem = missingProblem(row);
    if (problem) return { ...row, reason: problem };
    if (row.companionsError) return { ...row, reason: row.companionsError };

    const key = normalizeDocument(row.document);
    if (seen.has(key)) return { ...row, reason: 'documento duplicado en el archivo' };
    seen.add(key);

    return { ...row, reason: reasons.get(key) ?? null };
  });
}

function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

function formatWindow(from: string, until: string): string {
  const formatter = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  const start = new Date(from);
  const end = new Date(until);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Sin definir';
  return `${formatter.format(start)} → ${formatter.format(end)}`;
}

function batchErrorFor(code: string | undefined): string {
  switch (code) {
    case 'batch_too_large':
      return `El archivo supera el máximo de ${MAX_VISITORS} autorizaciones por lote.`;
    case 'destination_inactive':
      return 'Ese destino se archivó y ya no recibe autorizaciones. Elige otro.';
    case 'not_found':
    case 'foreign_community':
      return 'No encontramos ese destino en tu comunidad. Elige otro.';
    case 'forbidden':
      return 'No puedes autorizar visitas a ese destino.';
    case 'invalid':
      return 'Ese destino no acepta autorizaciones porque todavía tiene divisiones.';
    case 'daily_limit_reached':
      return 'Se alcanzó el límite de autorizaciones de hoy para esa vivienda.';
    case 'rate_limited':
      return 'Hiciste demasiados intentos seguidos. Espera unos segundos y reintenta.';
    case 'dynamic_qr_disabled':
      return 'Las autorizaciones con QR están desactivadas en tu comunidad.';
    default:
      return 'No pudimos procesar el lote. Reintenta en unos segundos.';
  }
}

function errorCode(err: unknown): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  const body = err.body as { message?: unknown } | null | undefined;
  return typeof body?.message === 'string' ? body.message : undefined;
}

export function ResidentAuthorizationBulkPage() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabled, setDisabled] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [destinationId, setDestinationId] = useState('');
  const [type, setType] = useState<PassTypeValue>('entry_exit');
  const [validFrom, setValidFrom] = useState(() => toLocalInput(new Date()));
  const [validUntil, setValidUntil] = useState(() =>
    toLocalInput(new Date(Date.now() + 8 * 60 * 60 * 1000)),
  );
  const [batchLabel, setBatchLabel] = useState('');
  const [maxUses, setMaxUses] = useState('1');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<'destination' | 'window' | 'file', string>>
  >({});
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<PassBatchResult | null>(null);

  const parsed = useMemo(() => (csvText.trim() ? parseCsv(csvText) : null), [csvText]);
  const visitors = useMemo(() => (parsed ? selectVisitors(parsed.rows) : []), [parsed]);
  const selectedDestination = destinations.find((item) => item.id === destinationId) ?? null;
  const homes = destinations.filter((item) => item.kind === 'home');
  const commonAreas = destinations.filter((item) => item.kind === 'common_area');
  const validCount = preview ? preview.filter((row) => row.reason === null).length : 0;
  const invalidCount = preview ? preview.length - validCount : 0;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');

    void (async () => {
      try {
        const response = await get<Destination[]>('/api/passes/destinations');
        if (!active) return;
        setDestinations(response.data);
        setDisabled(false);
      } catch (err) {
        if (!active) return;
        if (err instanceof ApiError && err.status === 404) {
          setDisabled(true);
        } else {
          setLoadError('No pudimos cargar los destinos. Reintenta en unos segundos.');
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Changing the destination, the window or the file turns the preview stale.
  useEffect(() => {
    setPreview(null);
    setSubmitError('');
  }, [destinationId, type, validFrom, validUntil, csvText]);

  function clearFieldError(field: 'destination' | 'window' | 'file') {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validate(): boolean {
    const errors: typeof fieldErrors = {};

    if (!destinationId) errors.destination = 'Elige el destino del lote.';

    const from = new Date(validFrom).getTime();
    const until = new Date(validUntil).getTime();
    if (Number.isNaN(from) || Number.isNaN(until)) {
      errors.window = 'Completa la vigencia del lote.';
    } else if (until <= from) {
      errors.window = 'La vigencia debe terminar después de empezar.';
    }

    if (parsed?.error) errors.file = parsed.error;
    else if (parsed?.limitError) errors.file = parsed.limitError;
    else if (!parsed || parsed.rows.length === 0) {
      errors.file = 'Carga un archivo o pega las filas del lote.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function batchPayload() {
    return {
      destination: destinationId,
      type,
      validFrom: new Date(validFrom).toISOString(),
      validUntil: new Date(validUntil).toISOString(),
      batchLabel: batchLabel.trim() || null,
      ...(type === 'entry_exit' ? { maxUses: Number(maxUses) || 1 } : {}),
      visitors,
    };
  }

  async function handlePreview() {
    if (!parsed || !validate()) return;

    // Rows without the minimum data never travel to the API, but they still
    // belong in the preview so the resident sees why they were skipped.
    if (visitors.length === 0) {
      setPreview(buildPreviewRows(parsed.rows, []));
      return;
    }

    setPreviewing(true);
    setSubmitError('');

    try {
      const response = await post<BatchPreviewResponse>(
        '/api/passes/batch/preview',
        batchPayload(),
      );
      setPreview(buildPreviewRows(parsed.rows, response.data.rejected));
    } catch (err) {
      setSubmitError(batchErrorFor(errorCode(err)));
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCreate() {
    if (!preview || visitors.length === 0) return;

    setCreating(true);
    setSubmitError('');

    try {
      const response = await post<PassBatchResult>('/api/passes/batch', batchPayload());
      setResult(response.data);
    } catch (err) {
      setSubmitError(batchErrorFor(errorCode(err)));
    } finally {
      setCreating(false);
    }
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    clearFieldError('file');
    setFileName(file.name);
    void file.text().then((text) => {
      setCsvText(text);
    });
    // Allows picking the same file twice in a row.
    event.target.value = '';
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'plantilla-autorizaciones.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function startAnotherBatch() {
    setResult(null);
    setPreview(null);
    setCsvText('');
    setFileName('');
    setBatchLabel('');
    setFieldErrors({});
    setSubmitError('');
  }

  if (result) {
    const historyLink = `/resident/authorizations?batchId=${encodeURIComponent(
      result.batchId,
    )}&batchLabel=${encodeURIComponent(result.batchLabel ?? 'Lote sin nombre')}`;

    return (
      <div className="p-6 space-y-6">
        <PageHeader
          title="Carga masiva"
          description="Resultado del lote que acabas de autorizar."
        />

        <section className="space-y-4">
          <div className="panel p-6">
            <h2 className="text-base font-semibold">
              {result.createdCount > 0 ? 'Lote creado' : 'No se creó ninguna autorización'}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.createdCount}{' '}
              {result.createdCount === 1 ? 'autorización creada' : 'autorizaciones creadas'}
              {' · '}
              {result.rejectedCount} {result.rejectedCount === 1 ? 'rechazada' : 'rechazadas'}
              {result.batchLabel ? ` · Lote: ${result.batchLabel}` : ''}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {result.createdCount > 0 && (
                <Button asChild>
                  <Link to={historyLink}>Ver historial del lote</Link>
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={startAnotherBatch}>
                Cargar otro lote
              </Button>
            </div>
          </div>

          {result.rejected.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Filas rechazadas</h3>
              <div className="overflow-hidden panel">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Visitante</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.rejected.map((rejection) => (
                      <TableRow key={`${rejection.document}-${rejection.reason}`}>
                        <TableCell>
                          {rejection.visitorFirstName} {rejection.visitorLastName}
                        </TableCell>
                        <TableCell>{rejection.document}</TableCell>
                        <TableCell className="whitespace-normal text-sm text-muted-foreground">
                          {rejection.reason}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Carga masiva"
        description="Autoriza varias visitas a la vez con un archivo CSV para un mismo destino."
        actions={
          <Button variant="outline" asChild>
            <Link to="/resident/authorizations">Volver al historial</Link>
          </Button>
        }
      />

      {disabled ? (
        <div className="panel p-6">
          <p className="text-sm font-medium">Las autorizaciones con QR están desactivadas</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tu administrador todavía no habilitó este módulo en la comunidad.
          </p>
        </div>
      ) : loadError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2">
          <p role="alert" className="text-sm text-destructive">
            {loadError}
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Reintentar
          </Button>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-10 w-full max-w-xl" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <section className="max-w-3xl space-y-4 panel p-6">
            <h2 className="font-heading text-lg font-semibold">Detalles del lote</h2>

            <div className="space-y-1">
              <Label htmlFor="bulk-destination">Destino del lote</Label>
              <Select
                value={destinationId}
                onValueChange={(value) => {
                  setDestinationId(value);
                  clearFieldError('destination');
                }}
                disabled={destinations.length === 0}
              >
                <SelectTrigger
                  id="bulk-destination"
                  aria-label="Destino del lote"
                  aria-invalid={Boolean(fieldErrors.destination)}
                >
                  <SelectValue placeholder="Elige un destino">
                    {selectedDestination?.path}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {homes.length > 0 && (
                    <>
                      <SelectItem value="__homes" disabled>
                        Mi vivienda
                      </SelectItem>
                      {homes.map((destination) => (
                        <SelectItem key={destination.id} value={destination.id}>
                          {destination.path}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {commonAreas.length > 0 && (
                    <>
                      <SelectItem value="__common" disabled>
                        Zonas comunes
                      </SelectItem>
                      {commonAreas.map((destination) => (
                        <SelectItem key={destination.id} value={destination.id}>
                          {destination.path}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {fieldErrors.destination && (
                <p role="alert" className="text-xs text-destructive">
                  {fieldErrors.destination}
                </p>
              )}
              {destinations.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Tu comunidad todavía no tiene destinos disponibles. Pídele al administrador que
                  defina la estructura en Unidades.
                </p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="bulk-valid-from">Válida desde</Label>
                <Input
                  id="bulk-valid-from"
                  type="datetime-local"
                  value={validFrom}
                  onChange={(event) => {
                    setValidFrom(event.target.value);
                    clearFieldError('window');
                  }}
                  aria-invalid={Boolean(fieldErrors.window)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bulk-valid-until">Válida hasta</Label>
                <Input
                  id="bulk-valid-until"
                  type="datetime-local"
                  value={validUntil}
                  onChange={(event) => {
                    setValidUntil(event.target.value);
                    clearFieldError('window');
                  }}
                  aria-invalid={Boolean(fieldErrors.window)}
                />
              </div>
            </div>

            {fieldErrors.window && (
              <p role="alert" className="text-xs text-destructive">
                {fieldErrors.window}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="bulk-type">Tipo de autorización</Label>
                <Select value={type} onValueChange={(value) => setType(value as PassTypeValue)}>
                  <SelectTrigger id="bulk-type" aria-label="Tipo de autorización">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry_only">Solo ingreso</SelectItem>
                    <SelectItem value="entry_exit">Ingreso y salida</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="bulk-max-uses">Usos permitidos</Label>
                <Input
                  id="bulk-max-uses"
                  type="number"
                  min={1}
                  max={20}
                  value={type === 'entry_only' ? '1' : maxUses}
                  disabled={type === 'entry_only'}
                  onChange={(event) => setMaxUses(event.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="bulk-label">Etiqueta del lote (opcional)</Label>
                <Input
                  id="bulk-label"
                  value={batchLabel}
                  maxLength={80}
                  placeholder="Ej.: Excursión del sábado"
                  onChange={(event) => setBatchLabel(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">{batchLabel.length}/80</p>
              </div>
            </div>
          </section>

          <section className="max-w-3xl space-y-4 panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-semibold">Visitantes</h2>
              <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
                <RiDownloadLine />
                Descargar plantilla
              </Button>
            </div>

            <div className="space-y-1">
              <Label htmlFor="bulk-file">Archivo CSV</Label>
              <input
                ref={fileInputRef}
                id="bulk-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
                className="sr-only"
              />
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border p-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <RiFileUploadLine /> Elegir archivo
                </Button>
                <span className="text-sm text-muted-foreground">
                  {fileName || 'Ningún archivo seleccionado'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Columnas: nombre, apellido, documento y placa (opcional). Para acompañantes, agrega
                la columna <span className="font-medium">acompañantes</span> con el formato{' '}
                <span className="font-mono">Nombre Apellido|Documento</span>, separados por punto y
                coma (máximo {MAX_COMPANIONS}). Si el archivo usa punto y coma como separador de
                columnas, encierra la celda entre comillas.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="bulk-csv">O pega las filas aquí</Label>
              <textarea
                id="bulk-csv"
                value={csvText}
                onChange={(event) => {
                  setCsvText(event.target.value);
                  clearFieldError('file');
                }}
                aria-label="Filas del lote en formato CSV"
                aria-invalid={Boolean(fieldErrors.file || parsed?.error || parsed?.limitError)}
                rows={6}
                spellCheck={false}
                placeholder={
                  'nombre,apellido,documento,placa,acompañantes\nAna,Torres,10203040,,Ana Pérez|123456;Luis Gómez|789012\nLuis,Gómez,55667788,ABC123,'
                }
                className="min-h-32 w-full rounded-3xl border border-transparent bg-input/50 px-3 py-2 font-mono text-sm outline-none transition-[color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
              />
            </div>

            {(fieldErrors.file || parsed?.error || parsed?.limitError) && (
              <p role="alert" className="text-xs text-destructive">
                {fieldErrors.file || parsed?.error || parsed?.limitError}
              </p>
            )}

            {parsed && !parsed.error && !parsed.limitError && (
              <p className="text-xs text-muted-foreground">
                {parsed.rows.length === 0
                  ? 'El archivo solo tiene los encabezados. Agrega al menos una fila.'
                  : `${parsed.rows.length} ${
                      parsed.rows.length === 1 ? 'fila leída' : 'filas leídas'
                    } · ${visitors.length} para autorizar.`}
              </p>
            )}

            <Button
              type="button"
              onClick={() => void handlePreview()}
              disabled={previewing || Boolean(parsed?.error) || Boolean(parsed?.limitError)}
            >
              <RiFileList3Line />
              {previewing ? 'Revisando…' : 'Revisar lote'}
            </Button>
          </section>

          {preview && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-heading text-lg font-semibold">Vista previa</h2>
                <p className="text-xs text-muted-foreground">
                  {preview.length} filas · {validCount} válidas · {invalidCount} con problemas
                </p>
              </div>

              <div className="overflow-hidden panel">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Apellido</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Placa</TableHead>
                      <TableHead>Acompañantes</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row) => (
                      <TableRow key={`${row.line}-${row.document}`}>
                        <TableCell>{row.firstName || '—'}</TableCell>
                        <TableCell>{row.lastName || '—'}</TableCell>
                        <TableCell>{row.document || '—'}</TableCell>
                        <TableCell>{row.plate ? row.plate.toUpperCase() : '—'}</TableCell>
                        <TableCell className="whitespace-normal text-xs text-muted-foreground">
                          {row.companions.length === 0
                            ? '—'
                            : row.companions
                                .map(
                                  (companion) =>
                                    `${companion.firstName} ${companion.lastName} (${companion.document})`,
                                )
                                .join(' · ')}
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {row.reason ? (
                            <div className="space-y-1">
                              <Badge variant="destructive">Inválida</Badge>
                              <p className="text-xs text-muted-foreground">{row.reason}</p>
                            </div>
                          ) : (
                            <Badge>Válida</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 panel p-6">
                <p className="text-sm">
                  Destino: <span className="font-medium">{selectedDestination?.path ?? '—'}</span>
                </p>
                <p className="text-sm">
                  Vigencia:{' '}
                  <span className="font-medium">{formatWindow(validFrom, validUntil)}</span>
                </p>

                {submitError && (
                  <p role="alert" className="text-sm text-destructive">
                    {submitError}
                  </p>
                )}

                <Button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={creating || validCount === 0}
                >
                  <RiUploadCloud2Line />
                  {creating
                    ? 'Creando…'
                    : validCount === 1
                      ? 'Crear 1 autorización'
                      : `Crear ${validCount} autorizaciones`}
                </Button>
                {validCount === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Ninguna fila quedó válida. Corrige el archivo y vuelve a revisar el lote.
                  </p>
                )}
              </div>
            </section>
          )}

          {submitError && !preview && (
            <p role="alert" className="text-sm text-destructive">
              {submitError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
