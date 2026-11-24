import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ApiError, downloadFile, get } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { ReportChart } from './ReportChart';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Skeleton } from '../ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { accessReasonLabel } from '../../lib/access-reasons';
import {
  formatLocalDate,
  formatLocalDateTime,
  shiftLocalDate,
  todayLocalDate,
} from '../../lib/local-dates';
import type {
  AccessReport,
  ReportExportFormat,
  ReportGranularity,
  ShiftReport,
} from '@porteria/shared';

type Family = 'access' | 'shifts';

/** Days covered by the initial range, today included. */
const DEFAULT_RANGE_DAYS = 7;

const ALL_COMMUNITIES = 'all';

const granularityLabels: Record<ReportGranularity, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};

const exportLabels: Record<ReportExportFormat, string> = {
  csv: 'CSV',
  xlsx: 'Excel',
  pdf: 'PDF',
};

interface Option {
  id: string;
  name: string;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'No se pudo cargar el reporte.';
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatSeconds(value: number | null): string {
  if (value === null) return '—';
  return `${value.toLocaleString('es-AR', { maximumFractionDigits: 1 })} s`;
}

function formatHours(value: number): string {
  return value.toLocaleString('es-AR', { maximumFractionDigits: 2 });
}

export function ReportsPanel() {
  const { user } = useAuth();
  const isPlatformAdmin = Boolean(user?.isPlatformAdmin);

  const [family, setFamily] = useState<Family>('access');
  const [from, setFrom] = useState(() =>
    shiftLocalDate(todayLocalDate(), -(DEFAULT_RANGE_DAYS - 1)),
  );
  const [to, setTo] = useState(() => todayLocalDate());
  const [granularity, setGranularity] = useState<ReportGranularity>('day');

  const [organizationId, setOrganizationId] = useState('');
  const [organizations, setOrganizations] = useState<Option[]>([]);
  const [communityId, setCommunityId] = useState(ALL_COMMUNITIES);
  const [communities, setCommunities] = useState<Option[]>([]);

  const [accessReport, setAccessReport] = useState<AccessReport | null>(null);
  const [shiftReport, setShiftReport] = useState<ShiftReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState<ReportExportFormat | null>(null);

  useEffect(() => {
    if (!isPlatformAdmin) {
      get<Option[]>('/api/communities')
        .then(({ data }) => setCommunities(data))
        .catch(() => setCommunities([]));
      return;
    }
    get<{ data: Option[] }>('/api/platform/organizations?pageSize=100')
      .then(({ data }) => {
        setOrganizations(data.data);
        setOrganizationId((current) => current || data.data[0]?.id || '');
      })
      .catch(() => setOrganizations([]));
  }, [isPlatformAdmin]);

  useEffect(() => {
    if (!isPlatformAdmin) return;
    if (!organizationId) {
      setCommunities([]);
      setCommunityId(ALL_COMMUNITIES);
      return;
    }
    get<Option[]>(`/api/communities?organizationId=${encodeURIComponent(organizationId)}`)
      .then(({ data }) => {
        setCommunities(data);
        setCommunityId(ALL_COMMUNITIES);
      })
      .catch(() => setCommunities([]));
  }, [isPlatformAdmin, organizationId]);

  const hasScope = !isPlatformAdmin || Boolean(organizationId);
  const periodValid = Boolean(from) && Boolean(to) && from <= to;

  /** The filters that the screen and the exported file share. */
  const scopeParams = useMemo(() => {
    const params = new URLSearchParams();
    if (isPlatformAdmin && organizationId) params.set('organizationId', organizationId);
    if (communityId !== ALL_COMMUNITIES) params.set('communityId', communityId);
    return params;
  }, [isPlatformAdmin, organizationId, communityId]);

  useEffect(() => {
    if (!hasScope || !periodValid) {
      setAccessReport(null);
      setShiftReport(null);
      setError('');
      setLoading(false);
      return;
    }

    let active = true;
    const params = new URLSearchParams(scopeParams);
    params.set('from', from);
    params.set('to', to);

    const path =
      family === 'access'
        ? `/api/reports/access?${params}&granularity=${granularity}`
        : `/api/reports/shifts?${params}`;

    setLoading(true);
    setError('');

    get<AccessReport | ShiftReport>(path)
      .then(({ data }) => {
        if (!active) return;
        if (family === 'access') setAccessReport(data as AccessReport);
        else setShiftReport(data as ShiftReport);
      })
      .catch((err) => {
        if (!active) return;
        setError(errorMessage(err));
        if (family === 'access') setAccessReport(null);
        else setShiftReport(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [family, from, to, granularity, hasScope, periodValid, scopeParams]);

  const current = family === 'access' ? accessReport : shiftReport;

  const handleExport = useCallback(
    async (format: ReportExportFormat) => {
      setExporting(format);
      setError('');
      try {
        const params = new URLSearchParams(scopeParams);
        params.set('report', family);
        params.set('format', format);
        params.set('from', from);
        params.set('to', to);
        if (family === 'access') params.set('granularity', granularity);
        const file = await downloadFile(`/api/reports/export?${params}`);
        saveBlob(file.blob, file.filename);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setExporting(null);
      }
    },
    [scopeParams, family, from, to, granularity],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Tabs value={family} onValueChange={(value) => setFamily(value as Family)}>
          <TabsList>
            <TabsTrigger value="access">Accesos</TabsTrigger>
            <TabsTrigger value="shifts">Turnos</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-end gap-2">
          <span className="self-center font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Exportar
          </span>
          {(Object.keys(exportLabels) as ReportExportFormat[]).map((format) => (
            <Button
              key={format}
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Exportar a ${exportLabels[format]}`}
              disabled={!current || loading || Boolean(exporting)}
              onClick={() => handleExport(format)}
            >
              {exporting === format ? 'Generando…' : exportLabels[format]}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {isPlatformAdmin && (
          <div className="space-y-1">
            <Label htmlFor="report-organization">Organización</Label>
            <select
              id="report-organization"
              aria-label="Organización"
              className="h-9 w-56 rounded border border-border bg-card px-2 font-mono text-[11px] text-foreground outline-none focus:border-ring"
              value={organizationId}
              onChange={(event) => setOrganizationId(event.target.value)}
            >
              <option value="">Seleccionar organización</option>
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="report-community">Comunidad</Label>
          <select
            id="report-community"
            aria-label="Comunidad"
            className="h-9 w-56 rounded border border-border bg-card px-2 font-mono text-[11px] text-foreground outline-none focus:border-ring disabled:opacity-50"
            value={communityId}
            onChange={(event) => setCommunityId(event.target.value)}
            disabled={isPlatformAdmin && !organizationId}
          >
            <option value={ALL_COMMUNITIES}>Todas las comunidades</option>
            {communities.map((community) => (
              <option key={community.id} value={community.id}>
                {community.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="report-from">Desde</Label>
          <Input
            id="report-from"
            type="date"
            className="w-44"
            value={from}
            max={to}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="report-to">Hasta</Label>
          <Input
            id="report-to"
            type="date"
            className="w-44"
            value={to}
            min={from}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>

        {family === 'access' && (
          <div className="space-y-1">
            <Label>Serie</Label>
            <Select
              value={granularity}
              onValueChange={(value) => setGranularity(value as ReportGranularity)}
            >
              <SelectTrigger className="w-36" aria-label="Granularidad de la serie">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(granularityLabels) as ReportGranularity[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {granularityLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {!hasScope && (
        <p className="text-sm text-muted-foreground">
          Selecciona una organización para ver los reportes de la plataforma.
        </p>
      )}

      {!periodValid && (
        <p className="text-sm text-destructive">
          La fecha inicial no puede ser posterior a la final.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {hasScope && periodValid && loading && <ReportSkeleton />}

      {hasScope && periodValid && !loading && !error && family === 'access' && accessReport && (
        <AccessReportView report={accessReport} />
      )}

      {hasScope && periodValid && !loading && !error && family === 'shifts' && shiftReport && (
        <ShiftReportView report={shiftReport} />
      )}
    </div>
  );
}

function AccessReportView({ report }: { report: AccessReport }) {
  const { totals } = report;

  const seriesData = report.series.map((point) => ({
    bucket: report.granularity === 'month' ? point.date : point.date.slice(5),
    Autorizados: point.authorized,
    Denegados: point.denied,
    'Fallas de código': point.codeFailure,
    Observaciones: point.observation,
  }));

  const hourData = report.byHour.map((point) => ({
    hour: `${String(point.hour).padStart(2, '0')}:00`,
    Accesos: point.count,
  }));

  if (totals.total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin accesos registrados entre el {formatLocalDate(report.from)} y el{' '}
        {formatLocalDate(report.to)}.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <MetricCard label="Accesos" value={String(totals.total)} />
        <MetricCard label="Autorizados" value={String(totals.authorized)} />
        <MetricCard label="Denegados" value={String(totals.denied)} />
        <MetricCard label="Fallas de código" value={String(totals.codeFailure)} />
        <MetricCard label="Observaciones" value={String(totals.observation)} />
        <MetricCard label="Ingresos" value={String(totals.entries)} />
        <MetricCard label="Salidas" value={String(totals.exits)} />
      </div>

      <Section
        title={`Accesos por ${report.granularity === 'day' ? 'día' : report.granularity === 'week' ? 'semana' : 'mes'}`}
      >
        <ReportChart
          data={seriesData}
          type="line"
          xKey="bucket"
          yKeys={[
            { key: 'Autorizados', name: 'Autorizados', color: 'var(--color-success)' },
            { key: 'Denegados', name: 'Denegados', color: 'var(--color-destructive)' },
            { key: 'Fallas de código', name: 'Fallas de código', color: 'var(--color-warning)' },
            { key: 'Observaciones', name: 'Observaciones', color: 'var(--color-muted-foreground)' },
          ]}
        />
      </Section>

      <Section title="Accesos por hora">
        <ReportChart
          data={hourData}
          type="bar"
          xKey="hour"
          yKeys={[{ key: 'Accesos', name: 'Accesos', color: 'var(--color-secondary)' }]}
        />
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Método de verificación">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Accesos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.byMethod.map((item) => (
                <TableRow key={item.method}>
                  <TableCell>{item.method === 'qr' ? 'QR' : 'Documento'}</TableCell>
                  <TableCell className="text-right font-mono">{item.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section title="Accesos por portería">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Portería</TableHead>
                <TableHead className="text-right">Accesos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.byAccessPoint.map((item) => (
                <TableRow key={item.accessPointId ?? item.accessPointName}>
                  <TableCell>{item.accessPointName}</TableCell>
                  <TableCell className="text-right font-mono">{item.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>

        <Section title="Motivos de denegación">
          {report.denialReasons.length === 0 ? (
            <EmptyNote>Sin denegaciones en el período.</EmptyNote>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Accesos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.denialReasons.map((item) => (
                  <TableRow key={item.reason}>
                    <TableCell>{accessReasonLabel(item.reason)}</TableCell>
                    <TableCell className="text-right font-mono">{item.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Section>
      </div>

      <Section title="Latencia de confirmación">
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <p className="font-sans text-2xl font-extrabold">
            {formatSeconds(report.latency.averageSeconds)}
          </p>
          {report.latency.confirmedScans === 0 ? (
            <p className="text-sm text-muted-foreground">
              Sin escaneos QR confirmados en el período. Los accesos por documento no se miden.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Promedio entre el escaneo y su confirmación, sobre{' '}
              <span className="font-mono">{report.latency.confirmedScans}</span> de{' '}
              <span className="font-mono">{report.latency.accessCount}</span> accesos con escaneo QR
              confirmado. Los accesos por documento no se miden.
            </p>
          )}
        </div>
      </Section>
    </>
  );
}

function ShiftReportView({ report }: { report: ShiftReport }) {
  if (report.totals.shifts === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin turnos registrados entre el {formatLocalDate(report.from)} y el{' '}
        {formatLocalDate(report.to)}.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard label="Turnos" value={String(report.totals.shifts)} />
        <MetricCard label="Abiertos" value={String(report.totals.openShifts)} />
        <MetricCard label="Cerrados" value={String(report.totals.closedShifts)} />
        <MetricCard label="Horas cumplidas" value={formatHours(report.totals.hours)} />
        <MetricCard label="Accesos" value={String(report.totals.accesses)} />
      </div>

      <Section title="Turnos sin cerrar">
        {report.openShifts.length === 0 ? (
          <EmptyNote>Todos los turnos del período están cerrados.</EmptyNote>
        ) : (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Turnos que siguen abiertos y necesitan cierre. Las horas no se cuentan hasta que
              terminen.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Guardia</TableHead>
                  <TableHead>Inicio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.openShifts.map((shift) => (
                  <TableRow key={shift.shiftId}>
                    <TableCell>{shift.guardName}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatLocalDateTime(shift.startedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Section>

      <Section title="Horas por guardia">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guardia</TableHead>
              <TableHead className="text-right">Turnos</TableHead>
              <TableHead className="text-right">Abiertos</TableHead>
              <TableHead className="text-right">Cerrados</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right">Accesos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.guards.map((guard) => (
              <TableRow key={guard.guardPersonId}>
                <TableCell>{guard.guardName}</TableCell>
                <TableCell className="text-right font-mono">{guard.shifts}</TableCell>
                <TableCell className="text-right font-mono">{guard.openShifts}</TableCell>
                <TableCell className="text-right font-mono">{guard.closedShifts}</TableCell>
                <TableCell className="text-right font-mono">{formatHours(guard.hours)}</TableCell>
                <TableCell className="text-right font-mono">{guard.accesses}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Turnos del período">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guardia</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead className="text-right">Accesos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.shifts.map((shift) => (
              <TableRow key={shift.shiftId}>
                <TableCell>{shift.guardName}</TableCell>
                <TableCell>
                  {shift.status === 'open' ? (
                    <Badge variant="warning">Abierto</Badge>
                  ) : (
                    <Badge variant="secondary">Cerrado</Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {formatLocalDateTime(shift.startedAt)}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {shift.endedAt ? formatLocalDateTime(shift.endedAt) : '—'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {shift.hours === null ? '—' : formatHours(shift.hours)}
                </TableCell>
                <TableCell className="text-right font-mono">{shift.accesses}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="px-4 pb-2 pt-4">
        <CardTitle className="font-heading text-base font-bold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">{children}</CardContent>
    </Card>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="px-4 pb-1 pt-4">
        <CardTitle className="min-h-8 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="font-sans text-2xl font-extrabold">{value}</p>
      </CardContent>
    </Card>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }, (_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
