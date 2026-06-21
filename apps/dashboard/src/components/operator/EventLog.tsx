import { useSocket } from '../../contexts/SocketContext';
import { Badge } from '../ui/badge';

const typeVariant: Record<string, 'warning' | 'default' | 'secondary' | 'outline'> = {
  CALL: 'warning',
  DOOR: 'default',
  SYS: 'secondary',
  END: 'outline',
};

export function EventLog() {
  const { eventLog } = useSocket();

  return (
    <div className="flex flex-col">
      <div className="px-4 py-2.5 text-xs font-bold tracking-widest uppercase text-muted-foreground border-b border-border">
        Registro de Eventos
      </div>
      <div className="p-2 flex flex-col gap-1">
        {eventLog.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-3">
            Sin eventos registrados
          </div>
        )}
        {eventLog.map((e, i) => (
          <div
            key={i}
            className="flex items-baseline gap-2.5 px-2.5 py-1.5 border border-border rounded font-mono text-[11px] bg-card"
          >
            <span className="text-muted-foreground text-[10px] flex-shrink-0">
              {e.timestamp.toLocaleTimeString('es-CO')}
            </span>
            <Badge variant={typeVariant[e.type] || 'outline'} className="text-[9px] px-1.5 py-0 flex-shrink-0">
              {e.type}
            </Badge>
            <span className="text-foreground">{e.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
