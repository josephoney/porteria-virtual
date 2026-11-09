import { Badge } from '../ui/badge';
import { useSocket } from '../../contexts/SocketContext';

const statusLabels: Record<string, string> = {
  idle: 'Disponible',
  calling: 'Llamando',
  'in-call': 'En llamada',
  offline: 'Desconectado',
};

const statusDot: Record<string, string> = {
  idle: 'bg-primary',
  calling: 'bg-warning animate-pulse',
  'in-call': 'bg-secondary',
  offline: 'bg-muted-foreground',
};

export function KioskList() {
  const { kiosks } = useSocket();

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
          Kiosks registrados
        </span>
        <Badge variant="outline" className="font-mono text-[10px]">
          {kiosks.length}
        </Badge>
      </div>
      <div className="p-3 flex flex-col gap-1">
        {kiosks.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-4">
            Ningún kiosk conectado
          </div>
        ) : (
          kiosks.map((k) => (
            <div
              key={k.kioskId}
              className="flex items-center gap-2.5 py-2 px-1 border-b border-border last:border-0"
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot[k.status] || 'bg-muted-foreground'}`}
              />
              <span className="text-xs flex-1 text-foreground">{k.kioskName}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {statusLabels[k.status] || k.status}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
