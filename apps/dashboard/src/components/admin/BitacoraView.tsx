import { useState, useEffect, useCallback } from 'react';
import { get } from '../../lib/apiClient';
import { EventTypeValues } from '@porteria/shared';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../ui/table';
import { Badge } from '../ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';

interface EventRow {
  id: string;
  eventType: string;
  actorId: string | null;
  actorRole: string | null;
  actorName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface EventsResponse {
  data: EventRow[];
  total: number;
  page: number;
  pageSize: number;
}

const badgeVariant: Record<string, 'default' | 'secondary' | 'warning' | 'outline' | 'destructive'> = {
  'call.started': 'warning',
  'call.ended': 'secondary',
  'call.missed': 'destructive',
  'door.open': 'default',
  'door.opened': 'default',
  'user.login': 'secondary',
  'user.logout': 'outline',
  'user.created': 'secondary',
  'user.updated': 'secondary',
  'kiosk.online': 'default',
  'kiosk.offline': 'warning',
};

const eventLabel: Record<string, string> = {
  'call.started': 'Llamada',
  'call.ended': 'Finalizada',
  'call.missed': 'Perdida',
  'door.open': 'Puerta',
  'door.opened': 'Puerta',
  'user.login': 'Login',
  'user.logout': 'Logout',
  'user.created': 'Usuario',
  'user.updated': 'Usuario',
  'kiosk.online': 'Kiosk',
  'kiosk.offline': 'Kiosk',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function BitacoraView() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filters, setFilters] = useState({ eventType: '', from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (filters.eventType) params.set('eventType', filters.eventType);
      if (filters.from) params.set('from', new Date(filters.from).toISOString());
      if (filters.to) params.set('to', new Date(filters.to + 'T23:59:59').toISOString());
      const result = await get<EventsResponse>(`/api/events?${params}`);
      setEvents(result.data.data);
      setTotal(result.data.total);
    } catch { setEvents([]); setTotal(0); } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <Select value={filters.eventType} onValueChange={(v) => { setFilters((f) => ({ ...f, eventType: v })); setPage(1); }}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Todos los tipos" /></SelectTrigger>
          <SelectContent>
            {EventTypeValues.map((t) => (
              <SelectItem key={t} value={t}>{eventLabel[t] || t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={filters.from} onChange={(e) => { setFilters((f) => ({ ...f, from: e.target.value })); setPage(1); }} className="w-40" />
        <Input type="date" value={filters.to} onChange={(e) => { setFilters((f) => ({ ...f, to: e.target.value })); setPage(1); }} className="w-40" />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground text-sm font-mono">No se encontraron eventos</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha/Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => (
                <>
                  <TableRow key={ev.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}>
                    <TableCell>{formatDateTime(ev.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={badgeVariant[ev.eventType] || 'outline'}>{eventLabel[ev.eventType] || ev.eventType}</Badge>
                    </TableCell>
                    <TableCell>{ev.actorName || ev.actorRole || '—'}</TableCell>
                    <TableCell className="truncate max-w-[200px]">{JSON.stringify(ev.metadata).substring(0, 60)}</TableCell>
                  </TableRow>
                  {expandedId === ev.id && (
                    <TableRow>
                      <TableCell colSpan={4} className="bg-muted/30">
                        <pre className="text-xs font-mono whitespace-pre-wrap m-0">{JSON.stringify(ev.metadata, null, 2)}</pre>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-center gap-2 text-sm font-mono">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Anterior</Button>
            <span className="text-muted-foreground">Pág. {page} de {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente →</Button>
          </div>
        </>
      )}
    </div>
  );
}
