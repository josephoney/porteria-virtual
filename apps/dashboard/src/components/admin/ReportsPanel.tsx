import { useState } from 'react';
import { get } from '../../lib/apiClient';
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
  const [period, setPeriod] = useState<Period>('daily');
  const [date, setDate] = useState(todayStr());
  const [week, setWeek] = useState(weekMonday());
  const [month, setMonth] = useState(thisMonth());
  const [data, setData] = useState<DailyReport | WeeklyReport | MonthlyReport | null>(null);
  const [callStats, setCallStats] = useState<CallStats | null>(null);
  const [loading, setLoading] = useState(false);

  async function fetchReport() {
    setLoading(true);
    try {
      if (period === 'daily') { const d = await get<DailyReport>(`/api/reports/daily?date=${date}`); setData(d.data); }
      else if (period === 'weekly') { const w = await get<WeeklyReport>(`/api/reports/weekly?week=${week}`); setData(w.data); }
      else { const m = await get<MonthlyReport>(`/api/reports/monthly?month=${month}`); setData(m.data); }
      const from = period === 'weekly' ? week : period === 'monthly' ? `${month}-01` : date;
      const cs = await get<CallStats>(`/api/reports/call-stats?from=${from}&to=${date}`);
      setCallStats(cs.data);
    } catch (err) { console.error('Failed to fetch report', err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <h3 className="font-sans text-lg font-extrabold tracking-wide">Reportes</h3>

      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList>
          <TabsTrigger value="daily">Diario</TabsTrigger>
          <TabsTrigger value="weekly">Semanal</TabsTrigger>
          <TabsTrigger value="monthly">Mensual</TabsTrigger>
        </TabsList>

        <TabsContent value={period}>
          <div className="flex gap-3 items-center mt-2">
            {period === 'daily' && <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />}
            {period === 'weekly' && <Input type="date" value={week} onChange={(e) => setWeek(e.target.value)} className="w-44" />}
            {period === 'monthly' && <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />}
            <Button onClick={fetchReport} disabled={loading}>{loading ? 'Cargando…' : 'Cargar'}</Button>
          </div>
        </TabsContent>
      </Tabs>

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
              <ReportChart data={data.callsByHour} type="bar" xKey="hour" yKeys={[{ key: 'count', name: 'Llamadas', color: 'var(--secondary)' }]} />
            )}
            {period === 'weekly' && 'days' in data && (
              <ReportChart
                data={(data as WeeklyReport).days.map((d) => ({ day: d.date.slice(5), Llamadas: d.totalCalls, Atendidas: d.answeredCalls, Perdidas: d.missedCalls, Puertas: d.doorOpens }))}
                type="line" xKey="day"
                yKeys={[{ key: 'Llamadas', name: 'Llamadas', color: 'var(--secondary)' }, { key: 'Atendidas', name: 'Atendidas', color: 'var(--primary)' }, { key: 'Puertas', name: 'Puertas', color: 'var(--warning)' }]}
              />
            )}
            {period === 'monthly' && 'weeks' in data && (
              <ReportChart
                data={(data as MonthlyReport).weeks.map((w) => ({ week: w.weekStart.slice(5), Llamadas: w.totalCalls, Atendidas: w.answeredCalls, Perdidas: w.missedCalls, Puertas: w.doorOpens }))}
                type="bar" xKey="week"
                yKeys={[{ key: 'Llamadas', name: 'Llamadas', color: '#3b82f6' }, { key: 'Atendidas', name: 'Atendidas', color: '#10b981' }, { key: 'Puertas', name: 'Puertas', color: '#f59e0b' }]}
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
