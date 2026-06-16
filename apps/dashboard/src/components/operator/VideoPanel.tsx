import { useRef, useEffect, useState } from 'react';

interface RelayButton {
  relayIndex: number;
  label: string;
  mode: 'momentary' | 'latch';
  durationMs: number | null;
  state: 'ON' | 'OFF';
}

interface ActiveCall {
  buildingName: string;
}

interface VideoPanelProps {
  activeCall: ActiveCall | null;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  isMuted: boolean;
  onOpenDoor: () => void;
  onToggleMute: () => void;
  onEndCall: () => void;
  onTriggerRelay?: (relayIndex: number) => void;
  doorRelay?: { gpioPin: number; durationMs: number | null; mode: string } | null;
  relays?: RelayButton[];
  compact?: boolean;
}

export function VideoPanel({
  activeCall,
  remoteStream,
  localStream,
  isMuted,
  onOpenDoor,
  onToggleMute,
  onEndCall,
  onTriggerRelay,
  doorRelay,
  relays,
  compact,
}: VideoPanelProps) {
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [callTimer, setCallTimer] = useState('00:00');

  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream;
      remoteRef.current.play().catch((e) =>
        console.log('[Dash] Remote video play blocked:', e.name),
      );
    }
    if (audioRef.current && remoteStream) {
      audioRef.current.srcObject = remoteStream;
      audioRef.current.play().catch((e) =>
        console.log('[Dash] Audio play blocked:', e.name),
      );
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
      localRef.current.play().catch((e) =>
        console.log('[Dash] Local video play blocked:', e.name),
      );
    }
  }, [localStream]);

  useEffect(() => {
    if (!activeCall) {
      setCallTimer('00:00');
      return;
    }
    const start = Date.now();
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      setCallTimer(`${mm}:${ss}`);
    }, 1000);
    return () => clearInterval(id);
  }, [activeCall]);

  if (!activeCall) {
    if (compact) return null;
    return (
      <div className="video-empty">
        <div className="video-empty-icon">📹</div>
        <div className="video-empty-text">Sin llamada activa</div>
        <div className="video-empty-sub">Espere una llamada entrante</div>
      </div>
    );
  }

  return (
    <div className="video-active">
      <div className="video-container">
        <video ref={remoteRef} className="remote-video" autoPlay playsInline />
        <video ref={localRef} className="local-video" autoPlay playsInline muted />
        <audio ref={audioRef} autoPlay />
        {!compact && (
          <div className="video-info">
            <div className="video-building">{activeCall.buildingName}</div>
            <div className="video-timer">{callTimer}</div>
          </div>
        )}
      </div>
      {!compact && (
      <div className="video-controls">
        <div className="vctrl">
          <button className="vctrl-btn action-green" onClick={onOpenDoor}>🔓</button>
          <span className="vctrl-label">Abrir</span>
          {doorRelay && (
            <span className="vctrl-detail">GPIO {doorRelay.gpioPin}{doorRelay.durationMs ? ` · ${Math.round(doorRelay.durationMs / 1000)}s` : ''}</span>
          )}
        </div>
        <div className="vctrl">
          <button
            className="vctrl-btn"
            onClick={onToggleMute}
            style={{ opacity: isMuted ? 0.4 : 1 }}
          >
            🎤
          </button>
          <span className="vctrl-label">{isMuted ? 'Silenciado' : 'Micrófono'}</span>
        </div>
        <div className="vctrl">
          <button className="vctrl-btn action-red" onClick={onEndCall}>📞</button>
          <span className="vctrl-label">Colgar</span>
        </div>
      </div>
      )}
      {!compact && relays && relays.length > 0 && (
        <div className="relay-controls">
          <div className="relay-controls-label">Relés</div>
          <div className="relay-buttons">
            {relays.map((r) => (
              <div className="relay-ctrl" key={r.relayIndex}>
                <button
                  className={`relay-btn ${r.mode === 'latch' ? (r.state === 'ON' ? 'relay-on' : 'relay-off') : ''}`}
                  onClick={() => onTriggerRelay?.(r.relayIndex)}
                >
                  {r.mode === 'latch' ? (r.state === 'ON' ? '●' : '○') : '⚡'}
                </button>
                <span className="relay-label">{r.label}</span>
                {r.mode === 'momentary' && r.durationMs && (
                  <span className="relay-duration">{Math.round(r.durationMs / 1000)}s</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
