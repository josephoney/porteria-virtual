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

const statusColors: Record<string, string> = {
  ended: 'text-primary',
  missed: 'text-destructive',
  active: 'text-secondary',
  pending: 'text-warning',
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
    <div className="border-t border-border">
      <button
        className="w-full px-4 py-2.5 text-xs font-bold tracking-wider uppercase text-muted-foreground hover:text-foreground text-left flex items-center justify-between transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        Mis llamadas
        <span className="text-[10px]">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-1">
          {calls.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-3">
              Aún no has atendido llamadas
            </div>
          )}
          {calls.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 py-1.5 px-2 text-xs border-b border-border last:border-0"
            >
              <span className="flex-1 font-semibold text-foreground">
                {c.kioskName || '--'}
              </span>
              <span className="font-mono text-muted-foreground">{formatTime(c.startedAt)}</span>
              <span className={`font-semibold text-[10px] uppercase tracking-wider ${statusColors[c.status] || 'text-muted-foreground'}`}>
                {statusLabels[c.status] || c.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
