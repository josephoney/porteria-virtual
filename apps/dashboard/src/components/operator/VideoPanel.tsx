import { useRef, useEffect, useState } from 'react';

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
}

export function VideoPanel({
  activeCall,
  remoteStream,
  localStream,
  isMuted,
  onOpenDoor,
  onToggleMute,
  onEndCall,
}: VideoPanelProps) {
  const remoteRef = useRef<HTMLVideoElement>(null);
  const localRef = useRef<HTMLVideoElement>(null);
  const [callTimer, setCallTimer] = useState('00:00');

  useEffect(() => {
    if (remoteRef.current) remoteRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    if (localRef.current) localRef.current.srcObject = localStream;
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
        <div className="video-info">
          <div className="video-building">{activeCall.buildingName}</div>
          <div className="video-timer">{callTimer}</div>
        </div>
      </div>
      <div className="video-controls">
        <div className="vctrl">
          <button className="vctrl-btn action-green" onClick={onOpenDoor}>🔓</button>
          <span className="vctrl-label">Abrir</span>
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
    </div>
  );
}
