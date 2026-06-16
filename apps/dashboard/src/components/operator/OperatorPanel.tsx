import { useEffect, useCallback, useState, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { CallQueue } from './CallQueue';
import { VideoPanel } from './VideoPanel';
import { KioskList } from './KioskList';
import { EventLog } from './EventLog';
import { RingtoneSelector } from './RingtoneSelector';
import { OperatorCallHistory } from './OperatorCallHistory';
import { CONFIG } from '../../config';

type CallDisplayMode = 'inline' | 'overlay';

export function OperatorPanel() {
  const { socket, pendingCalls, activeCall, addLog, setActiveCall, removePendingCall, stopRing } =
    useSocket();
  const webRTC = useWebRTC();
  const [toastCall, setToastCall] = useState<any>(null);
  const [callDisplayMode, setCallDisplayMode] = useState<CallDisplayMode>(() => {
    return (localStorage.getItem('callDisplayMode') as CallDisplayMode) || 'inline';
  });
  const [piPMinimized, setPiPMinimized] = useState(false);

  // Relay control state
  const { user, token } = useAuth();
  interface RelayConfig {
    id: string;
    relayIndex: number;
    gpioPin: number;
    label: string;
    mode: 'momentary' | 'latch';
    durationMs: number | null;
    accessPointId: string | null;
  }
  const [relayConfigs, setRelayConfigs] = useState<RelayConfig[]>([]);
  const [doorRelay, setDoorRelay] = useState<RelayConfig | null>(null);
  const [relayStates, setRelayStates] = useState<Record<number, 'ON' | 'OFF'>>({});
  const mqttSocketRef = useRef<Socket | null>(null);

  // Fetch relay configs when active call starts
  useEffect(() => {
    if (!activeCall || !user || !token) {
      setRelayConfigs([]);
      setDoorRelay(null);
      return;
    }

    const apiBase = CONFIG.API_BASE_URL || 'http://localhost:3000';
    const url = `${apiBase}/api/kiosks/${activeCall.buildingId}/relays`;
    console.log('[Relays] Fetching:', url, 'buildingId:', activeCall.buildingId);
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        console.log('[Relays] Response status:', res.status);
        if (!res.ok) return res.text().then((t) => { throw new Error(`HTTP ${res.status}: ${t}`); });
        return res.json();
      })
      .then((data: RelayConfig[]) => {
        console.log('[Relays] Data:', data);
        setRelayConfigs(data.filter((r) => !r.accessPointId));
        setDoorRelay(data.find((r) => r.accessPointId) ?? null);
      })
      .catch((err) => {
        console.error('[Relays] Fetch error:', err);
        setRelayConfigs([]);
        setDoorRelay(null);
      });
  }, [activeCall, user, token]);

  // Connect to MQTT bridge Socket.io for relay status
  useEffect(() => {
    if (!activeCall) return;
    const mqttUrl = CONFIG.MQTT_BRIDGE_URL || 'http://localhost:3002';
    const mqttSocket = io(mqttUrl, { transports: ['websocket'] });
    mqttSocketRef.current = mqttSocket;

    mqttSocket.on('relay:status', (data: { buildingId: string; relayIndex: number; state: 'ON' | 'OFF' }) => {
      if (data.buildingId === activeCall.buildingId) {
        setRelayStates((prev) => ({ ...prev, [data.relayIndex]: data.state }));
      }
    });

    return () => {
      mqttSocket.disconnect();
      mqttSocketRef.current = null;
    };
  }, [activeCall]);

  const handleTriggerRelay = useCallback(
    (relayIndex: number) => {
      if (!socket || !activeCall) return;
      socket.emit('relay:trigger', {
        buildingId: activeCall.buildingId,
        relayIndex,
      });
    },
    [socket, activeCall],
  );

  const webRTCRef = useRef(webRTC);
  webRTCRef.current = webRTC;
  const activeCallIdRef = useRef<string | null>(null);
  const setActiveCallRef = useRef(setActiveCall);
  setActiveCallRef.current = setActiveCall;
  const addLogRef = useRef(addLog);
  addLogRef.current = addLog;

  const toggleDisplayMode = () => {
    setCallDisplayMode((prev) => {
      const next = prev === 'inline' ? 'overlay' : 'inline';
      localStorage.setItem('callDisplayMode', next);
      return next;
    });
    setPiPMinimized(false);
  };

  useEffect(() => {
    if (pendingCalls.size === 0) {
      setToastCall(null);
      return;
    }
    const latest = Array.from(pendingCalls.values()).pop();
    setToastCall(latest);
    const t = setTimeout(() => setToastCall(null), 30000);
    return () => clearTimeout(t);
  }, [pendingCalls.size]);

  useEffect(() => {
    if (!socket) return;

    const onOffer = async ({ callId, offer }: any) => {
      await webRTCRef.current.handleOffer(socket, callId, offer);
    };
    const onIceCandidate = async ({ candidate }: any) => {
      await webRTCRef.current.handleIceCandidate(candidate);
    };
    const onCallEnded = () => {
      activeCallIdRef.current = null;
      webRTCRef.current.cleanupPeer();
      setActiveCallRef.current(null);
      setPiPMinimized(false);
      addLogRef.current('END', 'Llamada finalizada');
    };

    socket.on('webrtc:offer', onOffer);
    socket.on('webrtc:ice-candidate', onIceCandidate);
    socket.on('call:ended', onCallEnded);

    return () => {
      socket.off('webrtc:offer', onOffer);
      socket.off('webrtc:ice-candidate', onIceCandidate);
      socket.off('call:ended', onCallEnded);
    };
  }, [socket]);

  const handleAcceptCall = useCallback(
    async (callId: string) => {
      const call = pendingCalls.get(callId);
      if (!call) return;
      stopRing();
      await webRTCRef.current.getLocalStream();
      socket?.emit('call:accept', { callId, buildingId: call.buildingId });
      activeCallIdRef.current = callId;
      setActiveCall({ ...call });
      removePendingCall(callId);
      setPiPMinimized(false);
      addLog('CALL', `Llamada aceptada: ${call.buildingName}`);
    },
    [socket, pendingCalls, setActiveCall, removePendingCall, addLog, stopRing],
  );

  const handleOpenDoor = useCallback(() => {
    const cid = activeCallIdRef.current;
    if (!cid || !activeCall) return;
    socket?.emit('door:open', {
      callId: cid,
      buildingId: activeCall.buildingId,
    });
    addLog('DOOR', `Puerta abierta: ${activeCall.buildingName}`);
  }, [socket, activeCall, addLog]);

  const handleEndCall = useCallback(() => {
    const cid = activeCallIdRef.current;
    if (!cid || !activeCall) return;
    socket?.emit('call:end', { callId: cid });
    activeCallIdRef.current = null;
    webRTC.cleanupPeer();
    setActiveCall(null);
    setToastCall(null);
    setPiPMinimized(false);
    for (const [id, c] of pendingCalls) {
      if (c.buildingId === activeCall.buildingId) removePendingCall(id);
    }
    addLog('END', `Llamada finalizada: ${activeCall.buildingName}`);
  }, [socket, activeCall, pendingCalls, webRTC, setActiveCall, removePendingCall, addLog]);

  const showOverlay = callDisplayMode === 'overlay' && activeCall;

  return (
    <div className="panel-layout">
      <div className="panel-sidebar">
        <CallQueue pendingCalls={pendingCalls} onAccept={handleAcceptCall} />
        <KioskList />
      </div>
      <div className="panel-main">
        <div className="panel-main-header">
          <span className="panel-main-title">Videollamada</span>
          <div className="panel-main-controls">
            <RingtoneSelector />
            <label className="display-mode-toggle">
              <input
                type="checkbox"
                checked={callDisplayMode === 'overlay'}
                onChange={toggleDisplayMode}
              />
              <span className="toggle-label">Modo superpuesto</span>
            </label>
          </div>
        </div>
        {!showOverlay && (
          <VideoPanel
            activeCall={activeCall}
            remoteStream={webRTC.remoteStream}
            localStream={webRTC.localStream}
            isMuted={webRTC.isMuted}
            onOpenDoor={handleOpenDoor}
            onToggleMute={webRTC.toggleMute}
            onEndCall={handleEndCall}
            onTriggerRelay={handleTriggerRelay}
            doorRelay={doorRelay}
            relays={relayConfigs.map((r) => ({
              relayIndex: r.relayIndex,
              label: r.label,
              mode: r.mode,
              durationMs: r.durationMs,
              state: relayStates[r.relayIndex] || 'OFF',
            }))}
          />
        )}
        {showOverlay && !piPMinimized && (
          <div className="video-overlay">
            <div className="video-overlay-header">
              <span>{activeCall.buildingName}</span>
              <div className="video-overlay-actions">
                <button className="overlay-btn" onClick={() => setPiPMinimized(true)}>
                  Minimizar
                </button>
                <button className="overlay-btn" onClick={handleEndCall}>
                  Colgar
                </button>
              </div>
            </div>
            <VideoPanel
              activeCall={activeCall}
              remoteStream={webRTC.remoteStream}
              localStream={webRTC.localStream}
              isMuted={webRTC.isMuted}
              onOpenDoor={handleOpenDoor}
              onToggleMute={webRTC.toggleMute}
              onEndCall={handleEndCall}
              onTriggerRelay={handleTriggerRelay}
              doorRelay={doorRelay}
              relays={relayConfigs.map((r) => ({
                relayIndex: r.relayIndex,
                label: r.label,
                mode: r.mode,
                durationMs: r.durationMs,
                state: relayStates[r.relayIndex] || 'OFF',
              }))}
              compact
            />
          </div>
        )}
        {showOverlay && piPMinimized && (
          <div className="video-pip" onClick={() => setPiPMinimized(false)}>
            <video
              ref={(el) => { if (el) el.srcObject = webRTC.remoteStream; }}
              autoPlay
              playsInline
              muted
            />
            <div className="pip-label">{activeCall.buildingName}</div>
          </div>
        )}
        {showOverlay && (
          <div className="video-empty">
            <div className="video-empty-text">
              Llamada activa en modo superpuesto
            </div>
            <div className="video-empty-sub">{activeCall.buildingName}</div>
          </div>
        )}
      </div>
      <div className="panel-log">
        <EventLog />
        <OperatorCallHistory />
      </div>
      {toastCall && !activeCall && (
        <div className={`incoming-toast ${toastCall ? 'show' : ''}`}>
          <div className="toast-title">Llamada entrante</div>
          <div className="toast-building">{toastCall.buildingName}</div>
          {toastCall.visitor?.known && (
            <div className="toast-visitor">Visitante: {toastCall.visitor.name}</div>
          )}
          <div className="toast-actions">
            <button className="toast-btn answer" onClick={() => handleAcceptCall(toastCall.callId)}>
              Contestar
            </button>
            <button
              className="toast-btn reject"
              onClick={() => {
                socket?.emit('call:end', { callId: toastCall.callId, buildingId: toastCall.buildingId });
                removePendingCall(toastCall.callId);
                stopRing();
                setToastCall(null);
              }}
            >
              Ignorar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
