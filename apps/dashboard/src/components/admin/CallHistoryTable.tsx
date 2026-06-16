import { useState, useEffect, useCallback } from 'react';
import { get } from '../../lib/apiClient';

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

const statusLabels: Record<string, string> = {
  pending: 'Pendiente',
  active: 'Activa',
  ended: 'Finalizada',
  missed: 'Perdida',
};

const statusBadges: Record<string, string> = {
  pending: 'badge-dark',
  active: 'badge-green',
  ended: 'badge-blue',
  missed: 'badge-amber',
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

      const { data } = await get<{ data: CallData[]; total: number }>(
        `/api/calls?${params.toString()}`,
      );
      setCalls(data.data);
      setTotal(data.total);
    } catch {
      setCalls([]);
      setTotal(0);
    }
  }, [page, statusFilter, fromDate, toDate]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  const totalPages = Math.ceil(total / 10);

  return (
    <div className="users-section">
      <div className="users-header">
        <h2 className="admin-title">Historial de Llamadas</h2>
        <div className="call-filters">
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Todas</option>
            <option value="pending">Pendiente</option>
            <option value="active">Activa</option>
            <option value="ended">Finalizada</option>
            <option value="missed">Perdida</option>
          </select>
          <input
            className="form-input"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            placeholder="Desde"
          />
          <input
            className="form-input"
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            placeholder="Hasta"
          />
        </div>
      </div>

      <table className="users-table">
        <thead>
          <tr>
            <th>Estado</th>
            <th>Kiosk</th>
            <th>Operador</th>
            <th>Acceso</th>
            <th>Inicio</th>
            <th>Duración</th>
          </tr>
        </thead>
        <tbody>
          {calls.length === 0 && (
            <tr>
              <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                No hay llamadas registradas
              </td>
            </tr>
          )}
          {calls.map((c) => (
            <tr key={c.id}>
              <td>
                <span className={`role-badge ${statusBadges[c.status] || ''}`}>
                  {statusLabels[c.status] || c.status}
                </span>
              </td>
              <td>{c.kioskName || '--'}</td>
              <td>{c.operatorName || '--'}</td>
              <td>{c.accessPointName || '--'}</td>
              <td>{formatTime(c.startedAt)}</td>
              <td>{formatDuration(c.duration)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(page - 1)}>
            ←
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            →
          </button>
        </div>
      )}
    </div>
  );
}
