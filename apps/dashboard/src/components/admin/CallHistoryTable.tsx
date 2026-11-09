import { useState, useEffect, useCallback } from 'react';
import { get } from '../../lib/apiClient';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

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
  return new Date(iso).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', '10');
      if (statusFilter) params.set('status', statusFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const { data } = await get<{ data: CallData[]; total: number }>(
        `/api/calls?${params.toString()}`,
      );
      setCalls(data.data);
      setTotal(data.total);
    } catch {
      setCalls([]);
      setTotal(0);
      setError('No se pudieron cargar las llamadas. Reintentá en unos segundos.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, fromDate, toDate]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const totalPages = Math.ceil(total / 10);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-36" aria-label="Filtrar por estado">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
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
          aria-label="Desde"
          onChange={(event) => {
            setFromDate(event.target.value);
            setPage(1);
          }}
          className="w-40"
        />
        <Input
          type="date"
          value={toDate}
          aria-label="Hasta"
          onChange={(event) => {
            setToDate(event.target.value);
            setPage(1);
          }}
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
          {loading &&
            [...Array(5)].map((_, index) => (
              <TableRow key={`loading-${index}`}>
                <TableCell colSpan={6}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {!loading && error && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center">
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
                <Button variant="outline" size="sm" className="mt-3" onClick={fetchCalls}>
                  Reintentar
                </Button>
              </TableCell>
            </TableRow>
          )}

          {!loading && !error && calls.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                No hay llamadas registradas
              </TableCell>
            </TableRow>
          )}

          {!loading &&
            !error &&
            calls.map((call) => (
              <TableRow key={call.id}>
                <TableCell>
                  <Badge variant={statusBadgeVariant[call.status] || 'outline'}>
                    {statusLabel[call.status] || call.status}
                  </Badge>
                </TableCell>
                <TableCell>{call.kioskName || '--'}</TableCell>
                <TableCell>{call.operatorName || '--'}</TableCell>
                <TableCell>{call.accessPointName || '--'}</TableCell>
                <TableCell className="font-mono">{formatTime(call.startedAt)}</TableCell>
                <TableCell className="font-mono">{formatDuration(call.duration)}</TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm font-mono">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || loading}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
