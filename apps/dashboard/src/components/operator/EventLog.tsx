import { useSocket } from '../../contexts/SocketContext';

const typeStyles: Record<string, string> = {
  CALL: 'log-type-call',
  DOOR: 'log-type-door',
  SYS: 'log-type-sys',
  END: 'log-type-end',
};

export function EventLog() {
  const { eventLog } = useSocket();

  return (
    <div className="event-log">
      <div className="event-log-header">Registro de Eventos</div>
      <div className="event-log-list">
        {eventLog.map((e, i) => (
          <div key={i} className="log-entry">
            <span className="log-ts">{e.timestamp.toLocaleTimeString('es-CO')}</span>
            <span className={`log-type ${typeStyles[e.type] || ''}`}>{e.type}</span>
            <span className="log-msg">{e.message}</span>
          </div>
        ))}
        {eventLog.length === 0 && (
          <div className="sidebar-empty">Sin eventos registrados</div>
        )}
      </div>
    </div>
  );
}
