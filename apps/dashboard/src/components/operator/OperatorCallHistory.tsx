import { useState, useEffect, useCallback } from 'react';
import { get } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';

interface CallData {
  id: string;
  status: string;
  startedAt: string;
  kioskName: string | null;
}

const statusLabels: Record<string, string> = {
  ended: 'Atendida',
  missed: 'Perdida',
  active: 'Activa',
  pending: 'Pendiente',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export function OperatorCallHistory() {
  const { user } = useAuth();
  const [calls, setCalls] = useState<CallData[]>([]);
  const [expanded, setExpanded] = useState(false);

  const fetchCalls = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await get<{ data: CallData[] }>(
        `/api/calls?operatorId=${user.id}&pageSize=50`,
      );
      setCalls(data.data);
    } catch {
      setCalls([]);
    }
  }, [user]);

  useEffect(() => {
    fetchCalls();
    const interval = setInterval(fetchCalls, 60000);
    return () => clearInterval(interval);
  }, [fetchCalls]);

  if (!user) return null;

  return (
    <div className="operator-call-history">
      <div
        className="call-history-toggle"
        onClick={() => setExpanded(!expanded)}
      >
        Mis llamadas {expanded ? '▲' : '▼'}
      </div>
      {expanded && (
        <div className="call-history-list">
          {calls.length === 0 && (
            <div className="call-history-empty">Aún no has atendido llamadas</div>
          )}
          {calls.map((c) => (
            <div key={c.id} className="call-history-item">
              <span className="call-history-kiosk">{c.kioskName || '--'}</span>
              <span className="call-history-time">{formatTime(c.startedAt)}</span>
              <span className="call-history-status">
                {statusLabels[c.status] || c.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
