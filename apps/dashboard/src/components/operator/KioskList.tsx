import { useSocket } from '../../contexts/SocketContext';

const statusLabels: Record<string, string> = {
  idle: 'Disponible',
  calling: 'Llamando',
  'in-call': 'En llamada',
  offline: 'Desconectado',
};

export function KioskList() {
  const { kiosks } = useSocket();

  return (
    <div className="sidebar-section">
      <div className="sidebar-header">
        <div className="sidebar-title">Kiosks registrados</div>
        <span className="badge">{kiosks.length}</span>
      </div>
      <div className="sidebar-list">
        {kiosks.length === 0 ? (
          <div className="sidebar-empty">Ningún kiosk conectado</div>
        ) : (
          kiosks.map((k) => (
            <div key={k.buildingId} className="kiosk-item">
              <div className={`kiosk-dot ${k.status}`}></div>
              <div className="kiosk-name">{k.buildingName}</div>
              <div className="kiosk-status">{statusLabels[k.status] || k.status}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
