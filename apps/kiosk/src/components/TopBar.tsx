import { useClock } from '../hooks/useClock';
import type { StatusDot } from '../hooks/useKioskState';

interface TopBarProps {
  statusDot: StatusDot;
  visible: boolean;
}

const labels: Record<string, string> = {
  connected: 'CONECTADO',
  calling: 'LLAMANDO',
  'in-call': 'EN LLAMADA',
  '': 'DESCONECTADO',
};

export function TopBar({ statusDot, visible }: TopBarProps) {
  const time = useClock();

  if (!visible) return null;

  return (
    <div className="topbar">
      <div className="topbar-brand">PORTERÍA VIRTUAL</div>
      <div>
        <span className="topbar-time">{time}</span>
      </div>
      <div className="topbar-info">
        <span className={`status-dot ${statusDot}`}></span>
        <span>{labels[statusDot] || 'DESCONECTADO'}</span>
      </div>
    </div>
  );
}
