import { useRef, useEffect } from 'react';

interface InCallScreenProps {
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  operatorName: string;
  callTimer: string;
  isMuted: boolean;
  onMute: () => void;
  onHangUp: () => void;
}

export function InCallScreen({
  remoteStream,
  localStream,
  operatorName,
  callTimer,
  isMuted,
  onMute,
  onHangUp,
}: InCallScreenProps) {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div className="screen active" id="screen-incall">
      <div id="video-container">
        <video ref={remoteVideoRef} id="remote-video" autoPlay playsInline />
        <video ref={localVideoRef} id="local-video" autoPlay playsInline muted />
        <div className="operator-badge">
          Operador: <span id="operator-name-badge">{operatorName}</span>
        </div>
      </div>
      <div className="call-timer">{callTimer}</div>
      <div className="call-controls">
        <button
          className="ctrl-btn"
          style={{ opacity: isMuted ? 0.4 : 1 }}
          onClick={onMute}
          title="Silenciar"
        >
          <svg viewBox="0 0 24 24" fill="var(--text)">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        </button>
        <button className="ctrl-btn danger" onClick={onHangUp} title="Colgar">
          <svg viewBox="0 0 24 24" fill="var(--danger)">
            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08C.11 12.9 0 12.65 0 12.37c0-.28.11-.53.29-.71C3.34 8.77 7.46 7 12 7s8.66 1.77 11.71 4.66c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
