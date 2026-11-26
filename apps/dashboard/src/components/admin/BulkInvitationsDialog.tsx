import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { RiDownloadLine, RiFileList3Line, RiFileUploadLine } from '@remixicon/react';
import { ApiError, post } from '../../lib/apiClient';
import { indexHeaders, parseCsvTable } from '../../lib/csv';
import { Alert, AlertDescription } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { NativeSelect } from '../ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

export interface BulkInvitationCommunity {
  id: string;
  name: string;
}

interface BulkInvitationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communities: BulkInvitationCommunity[];
  defaultCommunityId?: string;
  onCreated?: () => void;
}

interface BulkRowInput {
  unit: string;
  email: string;
  name?: string;
}

type BulkRowStatus = 'valid' | 'created' | 'skipped' | 'failed';

interface BulkRowResult {
  index: number;
  unit: string;
  email: string;
  name?: string;
  status: BulkRowStatus;
  reason?: string;
  unitId?: string;
  unitPath?: string;
  candidates?: string[];
}

interface BulkSummary {
  total: number;
  valid: number;
  created: number;
  skipped: number;
  failed: number;
}

interface BulkResponse {
  rows: BulkRowResult[];
  summary: BulkSummary;
}

interface ParsedCsv {
  rows: BulkRowInput[];
  error: string | null;
}

type InvitationField = 'unit' | 'email' | 'name';

const MAX_ROWS = 500;

const HEADER_FIELDS: Record<string, InvitationField> = {
  unidad: 'unit',
  unidades: 'unit',
  unit: 'unit',
  correo: 'email',
  correos: 'email',
  email: 'email',
  mail: 'email',
  correoelectronico: 'email',
  nombre: 'name',
  nombres: 'name',
  name: 'name',
  residente: 'name',
};

const TEMPLATE_CSV =
  'unidad,correo,nombre\nA-101,ana@example.com,Ana Torres\n' +
  'Torre A > Piso 2 > A-201,luis@example.com,Luis Gómez\n';

const REASON_LABELS: Record<string, string> = {
  invalid_email: 'Correo inválido',
  unit_required: 'Falta la unidad',
  unit_not_found: 'Unidad no encontrada',
  unit_not_leaf: 'La unidad no es una hoja',
  unit_ambiguous: 'Unidad ambigua',
  duplicate_row: 'Fila duplicada',
  already_member: 'Ya es miembro',
  conflict: 'Invitación pendiente',
  invitation_conflict: 'Invitación pendiente',
  forbidden: 'Sin permiso',
  unit_invalid: 'Unidad inválida',
  too_many_units: 'Demasiadas unidades',
  not_found: 'No encontrada',
};

function parseInvitationCsv(raw: string): ParsedCsv {
  const table = parseCsvTable(raw);
  if (table.header.length === 0) return { rows: [], error: null };

  const columns = indexHeaders(table.header, HEADER_FIELDS);
  const missing = (['unit', 'email'] as const).filter((field) => !columns.has(field));
  if (missing.length > 0) {
    const labels = missing.map((field) => (field === 'unit' ? 'unidad' : 'correo')).join(' y ');
    return {
      rows: [],
      error: `Faltan las columnas: ${labels}. Usa la plantilla con unidad, correo y nombre opcional.`,
    };
  }

  const rows = table.rows.map((row) => {
    const read = (field: InvitationField) => {
      const position = columns.get(field);
      return position === undefined ? '' : (row.cells[position] ?? '').trim();
    };
    const name = read('name');
    return {
      unit: read('unit'),
      email: read('email'),
      ...(name ? { name } : {}),
    };
  });

  if (rows.length > MAX_ROWS) {
    return {
      rows: [],
      error: `El lote tiene ${rows.length} filas y el máximo es ${MAX_ROWS}.`,
    };
  }

  return { rows, error: null };
}

function statusLabel(row: BulkRowResult): string {
  if (row.status === 'valid') return 'Válida';
  if (row.status === 'created') return 'Creada';
  if (row.status === 'skipped') return 'Omitida';
  return 'Fallida';
}

function statusVariant(row: BulkRowResult): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (row.status === 'valid' || row.status === 'created') return 'default';
  if (row.status === 'skipped') return 'secondary';
  return 'destructive';
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body;
    const code =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message?: unknown }).message ?? '')
        : '';
    if (code === 'too_many_rows') return `El lote supera el máximo de ${MAX_ROWS} filas.`;
    if (code === 'forbidden') return 'No tienes permiso para invitar en esa comunidad.';
    return err.message;
  }
  return err instanceof Error ? err.message : 'No se pudo procesar el lote.';
}

export function BulkInvitationsDialog({
  open,
  onOpenChange,
  communities,
  defaultCommunityId,
  onCreated,
}: BulkInvitationsDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [communityId, setCommunityId] = useState(defaultCommunityId ?? '');
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<BulkResponse | null>(null);
  const [result, setResult] = useState<BulkResponse | null>(null);
  const [retryNotice, setRetryNotice] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [sendError, setSendError] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCommunityId((current) => current || defaultCommunityId || communities[0]?.id || '');
  }, [open, defaultCommunityId, communities]);

  useEffect(() => {
    if (open) return;
    setCommunityId(defaultCommunityId ?? '');
    setCsvText('');
    setFileName('');
    setPreview(null);
    setResult(null);
    setRetryNotice('');
    setFieldError('');
    setSendError('');
    setReviewing(false);
    setSending(false);
  }, [open, defaultCommunityId]);

  const parsed = useMemo(() => (csvText.trim() ? parseInvitationCsv(csvText) : null), [csvText]);

  function resetOutput() {
    setPreview(null);
    setResult(null);
    setRetryNotice('');
    setSendError('');
    setFieldError('');
  }

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    resetOutput();
    void file.text().then((text) => setCsvText(text));
    event.target.value = '';
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'plantilla-invitaciones.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function review() {
    if (!communityId) {
      setFieldError('Elige la comunidad del lote.');
      return;
    }
    if (!parsed || parsed.error || parsed.rows.length === 0) {
      setFieldError(parsed?.error ?? 'Carga un archivo o pega al menos una fila.');
      return;
    }

    setReviewing(true);
    setFieldError('');
    setSendError('');
    try {
      const { data } = await post<BulkResponse>('/api/invitations/bulk/preview', {
        communityId,
        rows: parsed.rows,
      });
      setPreview(data);
      setResult(null);
      setRetryNotice('');
    } catch (err) {
      setSendError(errorMessage(err));
    } finally {
      setReviewing(false);
    }
  }

  async function send(rows: BulkRowInput[], retry: boolean) {
    if (!communityId || rows.length === 0) return;

    setSending(true);
    setSendError('');
    try {
      const { data } = await post<BulkResponse>('/api/invitations/bulk', {
        communityId,
        rows,
      });
      setResult(data);
      setPreview(null);
      setRetryNotice(retry ? `Reintento de ${rows.length} filas fallidas.` : '');
      if (data.summary.created > 0) onCreated?.();
    } catch (err) {
      setSendError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  function retryFailed() {
    if (!result) return;
    const failed = result.rows
      .filter((row) => row.status === 'failed')
      .map<BulkRowInput>((row) => ({
        unit: row.unit,
        email: row.email,
        ...(row.name ? { name: row.name } : {}),
      }));
    void send(failed, true);
  }

  const rows = result?.rows ?? preview?.rows ?? [];
  const summary = result?.summary ?? preview?.summary ?? null;
  const validCount = preview?.summary.valid ?? 0;
  const failedCount = result?.summary.failed ?? 0;
  const canSend = Boolean(preview) && validCount > 0 && !sending;
  const canReview =
    Boolean(communityId) && parsed !== null && !parsed.error && parsed.rows.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Carga masiva de invitaciones</DialogTitle>
          <DialogDescription>
            Una fila por unidad y correo. Se envía una invitación por fila; las unidades repetidas
            para el mismo correo se omiten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="bulk-invitations-community">Comunidad</Label>
          <NativeSelect
            id="bulk-invitations-community"
            value={communityId}
            onChange={(event) => {
              setCommunityId(event.target.value);
              resetOutput();
            }}
          >
            <option value="">Elegir…</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        {!result && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="bulk-invitations-file">Archivo CSV</Label>
              <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
                <RiDownloadLine className="size-4" aria-hidden="true" />
                Descargar plantilla
              </Button>
            </div>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                id="bulk-invitations-file"
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
                  <RiFileUploadLine className="size-4" aria-hidden="true" />
                  Elegir archivo
                </Button>
                <span className="text-sm text-muted-foreground">
                  {fileName || 'Ningún archivo seleccionado'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Columnas: <span className="font-mono">unidad</span>,{' '}
                <span className="font-mono">correo</span> y{' '}
                <span className="font-mono">nombre</span> (opcional). La unidad puede ser el código
                o el path <span className="font-mono">Nivel &gt; Nivel &gt; Unidad</span>. Máximo{' '}
                {MAX_ROWS} filas.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="bulk-invitations-csv">O pega las filas aquí</Label>
              <textarea
                id="bulk-invitations-csv"
                value={csvText}
                onChange={(event) => {
                  setCsvText(event.target.value);
                  resetOutput();
                }}
                aria-label="Filas del lote de invitaciones en formato CSV"
                aria-invalid={Boolean(fieldError || parsed?.error)}
                rows={6}
                spellCheck={false}
                placeholder={
                  'unidad,correo,nombre\nA-101,ana@example.com,Ana Torres\nTorre A > Piso 2 > A-201,luis@example.com,Luis Gómez'
                }
                className="min-h-32 w-full rounded-3xl border border-transparent bg-input/50 px-3 py-2 font-mono text-sm outline-none transition-[color,box-shadow,background-color] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
              />
            </div>

            {(fieldError || parsed?.error) && (
              <p role="alert" className="text-xs text-destructive">
                {fieldError || parsed?.error}
              </p>
            )}

            {parsed && !parsed.error && (
              <p className="text-xs text-muted-foreground">
                {parsed.rows.length === 0
                  ? 'El archivo solo tiene los encabezados. Agrega al menos una fila.'
                  : `${parsed.rows.length} ${parsed.rows.length === 1 ? 'fila leída' : 'filas leídas'}.`}
              </p>
            )}
          </>
        )}

        {sendError && (
          <Alert variant="destructive">
            <AlertDescription>{sendError}</AlertDescription>
          </Alert>
        )}

        {retryNotice && (
          <p role="status" className="text-sm text-muted-foreground">
            {retryNotice}
          </p>
        )}

        {summary && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">
              {summary.total} {summary.total === 1 ? 'fila' : 'filas'}
            </span>
            {result ? (
              <>
                <Badge>{summary.created} creadas</Badge>
                {summary.skipped > 0 && <Badge variant="secondary">{summary.skipped} omitidas</Badge>}
                {summary.failed > 0 && <Badge variant="destructive">{summary.failed} fallidas</Badge>}
              </>
            ) : (
              <>
                <Badge>{summary.valid} válidas</Badge>
                {summary.failed > 0 && <Badge variant="destructive">{summary.failed} con problemas</Badge>}
              </>
            )}
          </div>
        )}

        {rows.length > 0 && (
          <div className="max-h-80 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fila</TableHead>
                  <TableHead>Unidad</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={`${row.index}-${row.email}-${row.unit}`}>
                    <TableCell className="font-mono text-xs">{row.index + 2}</TableCell>
                    <TableCell>
                      <p className="text-sm">{row.unitPath ?? row.unit ?? '—'}</p>
                      {row.unitPath && row.unit !== row.unitPath && (
                        <p className="text-xs text-muted-foreground">{row.unit}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{row.email}</TableCell>
                    <TableCell className="text-sm">{row.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row)}>{statusLabel(row)}</Badge>
                    </TableCell>
                    <TableCell className="max-w-64 text-xs text-muted-foreground">
                      {row.reason ? (REASON_LABELS[row.reason] ?? row.reason) : '—'}
                      {row.candidates && row.candidates.length > 0 && (
                        <span className="mt-1 block">
                          Candidatas: {row.candidates.join(' · ')}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {result ? (
          <DialogFooter className="flex-wrap gap-2">
            {failedCount > 0 && (
              <Button type="button" variant="outline" onClick={retryFailed} disabled={sending}>
                <RiFileList3Line className="size-4" aria-hidden="true" />
                {sending ? 'Reintentando…' : `Reintentar ${failedCount} fallidas`}
              </Button>
            )}
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        ) : preview ? (
          <DialogFooter className="flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPreview(null)}
              disabled={sending}
            >
              Volver
            </Button>
            <Button type="button" onClick={() => void send(parsed?.rows ?? [], false)} disabled={!canSend}>
              {sending ? 'Enviando…' : `Enviar ${validCount} invitaciones`}
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void review()}
              disabled={reviewing || !canReview}
            >
              {reviewing ? 'Revisando…' : 'Revisar lote'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
