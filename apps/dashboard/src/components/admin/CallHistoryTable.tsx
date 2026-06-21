import { useState, useEffect, useCallback } from 'react';
import { get } from '../../lib/apiClient';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface CallData {
  id: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  kioskName: string | null;
  operatorName: string | null;
  accessPointName: string | null;
}

const statusBadgeVariant: Record<string, 'default' | 'secondary' | 'outline' | 'warning'> = {
  pending: 'outline',
  active: 'default',
  ended: 'secondary',
  missed: 'warning',
};

const statusLabel: Record<string, string> = {
  pending: 'Pendiente',
  active: 'Activa',
  ended: 'Finalizada',
  missed: 'Perdida',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '--';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

export function CallHistoryTable() {
  const [calls, setCalls] = useState<CallData[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const fetchCalls = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '10');
      if (statusFilter) params.set('status', statusFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const { data } = await get<{ data: CallData[]; total: number }>(`/api/calls?${params.toString()}`);
      setCalls(data.data);
      setTotal(data.total);
    } catch {
      setCalls([]);
      setTotal(0);
    }
  }, [page, statusFilter, fromDate, toDate]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-4">
      <h3 className="font-sans text-lg font-extrabold tracking-wide">Historial de Llamadas</h3>

      <div className="flex gap-3 flex-wrap">
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Todas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="active">Activa</SelectItem>
            <SelectItem value="ended">Finalizada</SelectItem>
            <SelectItem value="missed">Perdida</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
          className="w-40"
        />
        <Input
          type="date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); setPage(1); }}
          className="w-40"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Estado</TableHead>
            <TableHead>Kiosk</TableHead>
            <TableHead>Operador</TableHead>
            <TableHead>Acceso</TableHead>
            <TableHead>Inicio</TableHead>
            <TableHead>Duración</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                No hay llamadas registradas
              </TableCell>
            </TableRow>
          )}
          {calls.map((c) => (
            <TableRow key={c.id}>
              <TableCell><Badge variant={statusBadgeVariant[c.status] || 'outline'}>{statusLabel[c.status] || c.status}</Badge></TableCell>
              <TableCell>{c.kioskName || '--'}</TableCell>
              <TableCell>{c.operatorName || '--'}</TableCell>
              <TableCell>{c.accessPointName || '--'}</TableCell>
              <TableCell>{formatTime(c.startedAt)}</TableCell>
              <TableCell>{formatDuration(c.duration)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm font-mono">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>←</Button>
          <span className="text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>→</Button>
        </div>
      )}
    </div>
  );
}
