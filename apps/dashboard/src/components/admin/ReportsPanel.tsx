import { useState, useEffect } from 'react';
import { get } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { ReportChart } from './ReportChart';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import type { DailyReport, WeeklyReport, MonthlyReport, CallStats } from '@porteria/shared';

type Period = 'daily' | 'weekly' | 'monthly';

function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function weekMonday(): string { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - day + (day === 0 ? -6 : 1)); return d.toISOString().slice(0, 10); }
function thisMonth(): string { return new Date().toISOString().slice(0, 7); }

export function ReportsPanel() {
  const { user } = useAuth();
  const isPlatformAdmin = Boolean(user?.isPlatformAdmin);
  const [period, setPeriod] = useState<Period>('daily');
  const [date, setDate] = useState(todayStr());
  const [week, setWeek] = useState(weekMonday());
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<DailyReport | WeeklyReport | MonthlyReport | null>(null);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [organizations, setOrganizations] = useState<{ id: string; name: string }[]>([]);
  const [communityId, setCommunityId] = useState('');
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!isPlatformAdmin) {
      get<{ id: string; name: string }[]>('/api/communities')
        .then(({ data }) => setCommunities(data))
        .catch(() => setCommunities([]));
      return;
    }
    get<{ data: { id: string; name: string }[] }>('/api/platform/organizations?pageSize=100')
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
      setCommunityId('');
      return;
    }
    get<{ id: string; name: string }[]>(
      `/api/communities?organizationId=${encodeURIComponent(organizationId)}`,
    )
      .then(({ data }) => {
        setCommunities(data);
        setCommunityId('');
      })
      .catch(() => setCommunities([]));
  }, [isPlatformAdmin, organizationId]);

  async function fetchReport() {
    setError('');
    if (isPlatformAdmin && !organizationId) {
      setError('Seleccioná una organización para cargar los reportes.');
      return;
    }
    setLoading(true);
    const orgQuery = isPlatformAdmin ? `&organizationId=${organizationId}` : '';
    const communityQuery = communityId ? `&communityId=${communityId}` : '';
    try {
      if (period === 'daily') { const d = await get<DailyReport>(`/api/reports/daily?date=${date}${orgQuery}${communityQuery}`); setData(d.data); }
      else if (period === 'weekly') { const w = await get<WeeklyReport>(`/api/reports/weekly?week=${week}${orgQuery}${communityQuery}`); setData(w.data); }
      else { const m = await get<MonthlyReport>(`/api/reports/monthly?month=${month}${orgQuery}${communityQuery}`); setData(m.data); }
      const from = period === 'weekly' ? week : period === 'monthly' ? `${month}-01` : date;
      const cs = await get<CallStats>(`/api/reports/call-stats?from=${from}&to=${date}${orgQuery}${communityQuery}`);
      setCallStats(cs.data);
    } catch (err) {
      console.error('Failed to fetch report', err);
      setError('No se pudieron cargar los reportes para el alcance seleccionado.');
      setData(null);
      setCallStats(null);
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          <TabsTrigger value="daily">Diario</TabsTrigger>
          <TabsTrigger value="weekly">Semanal</TabsTrigger>
          <TabsTrigger value="monthly">Mensual</TabsTrigger>
        </TabsList>

        <TabsContent value={period}>
          <div className="flex flex-wrap gap-3 items-center mt-2">
            {isPlatformAdmin && (
              <select
                aria-label="Organización"
                className="h-9 px-2 rounded border border-border bg-card text-foreground font-mono text-[11px] outline-none focus:border-ring"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
              >
                <option value="">Seleccionar organización</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            )}
            {period === 'daily' && <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />}
            {period === 'weekly' && <Input type="date" value={week} onChange={(e) => setWeek(e.target.value)} className="w-44" />}
            {period === 'monthly' && <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />}
            <select
              aria-label="Comunidad"
              className="h-9 px-2 rounded border border-border bg-card text-foreground font-mono text-[11px] outline-none focus:border-ring"
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              disabled={isPlatformAdmin && !organizationId}
            >
              <option value="">Todas las comunidades</option>
              {communities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <Button
              onClick={fetchReport}
              disabled={loading || (isPlatformAdmin && !organizationId)}
            >
              {loading ? 'Cargando…' : 'Cargar'}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!data && !loading && !error && (
        <p className="text-sm text-muted-foreground">
          {isPlatformAdmin && !organizationId
            ? 'Seleccioná una organización para ver reportes globales.'
            : 'Elegí un período y presioná Cargar para ver los reportes.'}
        </p>
      )}

      {data && callStats && !loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Llamadas" value={String(callStats.totalCalls)} />
            <MetricCard label="Atendidas" value={String(callStats.answeredCount)} />
            <MetricCard label="Perdidas" value={String(callStats.missedCount)} />
            {'totalDoorOpens' in data && <MetricCard label="Puertas" value={String(data.totalDoorOpens)} />}
            {'totals' in data && <MetricCard label="Puertas" value={String(data.totals.doors)} />}
          </div>

          <div>
            <h4 className="font-sans text-base font-bold mb-3">
              {period === 'daily' ? 'Llamadas por Hora' : period === 'weekly' ? 'Tendencia Diaria' : 'Por Semana'}
            </h4>
            {period === 'daily' && 'callsByHour' in data && (
              <ReportChart data={data.callsByHour} type="bar" xKey="hour" yKeys={[{ key: 'count', name: 'Llamadas', color: 'var(--color-secondary)' }]} />
            )}
            {period === 'weekly' && 'days' in data && (
              <ReportChart
                data={(data as WeeklyReport).days.map((d) => ({ day: d.date.slice(5), Llamadas: d.totalCalls, Atendidas: d.answeredCalls, Perdidas: d.missedCalls, Puertas: d.doorOpens }))}
                type="line" xKey="day"
                yKeys={[{ key: 'Llamadas', name: 'Llamadas', color: 'var(--color-secondary)' }, { key: 'Atendidas', name: 'Atendidas', color: 'var(--color-primary)' }, { key: 'Puertas', name: 'Puertas', color: 'var(--color-warning)' }]}
              />
            )}
            {period === 'monthly' && 'weeks' in data && (
              <ReportChart
                data={(data as MonthlyReport).weeks.map((w) => ({ week: w.weekStart.slice(5), Llamadas: w.totalCalls, Atendidas: w.answeredCalls, Perdidas: w.missedCalls, Puertas: w.doorOpens }))}
                type="bar" xKey="week"
                yKeys={[{ key: 'Llamadas', name: 'Llamadas', color: 'var(--color-secondary)' }, { key: 'Atendidas', name: 'Atendidas', color: 'var(--color-primary)' }, { key: 'Puertas', name: 'Puertas', color: 'var(--color-warning)' }]}
              />
            )}
          </div>

          {period === 'weekly' && 'days' in data && (
            <div>
              <h4 className="font-sans text-base font-bold mb-3">Desglose Diario</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead><TableHead>Llamadas</TableHead><TableHead>Atendidas</TableHead><TableHead>Perdidas</TableHead><TableHead>Puertas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data as WeeklyReport).days.map((d) => (
                    <TableRow key={d.date}>
                      <TableCell>{d.date.slice(5)}</TableCell>
                      <TableCell>{d.totalCalls}</TableCell>
                      <TableCell>{d.answeredCalls}</TableCell>
                      <TableCell>{d.missedCalls}</TableCell>
                      <TableCell>{d.doorOpens}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div>
            <h4 className="font-sans text-base font-bold mb-3">Métricas de Llamadas</h4>
            <div className="flex gap-3 flex-wrap">
              <MetricCard label="Tasa de Atención" value={`${callStats.answerRate}%`} />
              <MetricCard label="Duración Promedio" value={`${callStats.avgDuration}s`} />
              <MetricCard label="Atendidas" value={String(callStats.answeredCount)} />
              <MetricCard label="Perdidas" value={String(callStats.missedCount)} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pb-4 px-4">
        <p className="font-sans text-2xl font-extrabold">{value}</p>
      </CardContent>
    </Card>
  );
}
