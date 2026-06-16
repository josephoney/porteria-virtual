import { useClock } from '../hooks/useClock';
import { CONFIG } from '../config';

interface IdleScreenProps {
  onCall: () => void;
  deviceSummary?: string;
}

export function IdleScreen({ onCall, deviceSummary }: IdleScreenProps) {
  const time = useClock();

  return (
    <div className="screen active" id="screen-idle">
      <div className="time-display">{time}</div>
      <div className="building-name">{CONFIG.BUILDING_NAME}</div>
      <div className="building-address">{CONFIG.ADDRESS}</div>
      <button className="call-btn" onClick={onCall}>
        <svg viewBox="0 0 24 24">
          <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
        </svg>
        <span className="call-btn-label">LLAMAR</span>
      </button>
      <div className="call-hint">Presione para comunicarse con portería</div>
      {deviceSummary && (
        <div className="device-diag">
          <pre>{deviceSummary}</pre>
        </div>
      )}
    </div>
  );
}
