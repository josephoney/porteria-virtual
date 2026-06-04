import { useEffect, useCallback, useState, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { CallQueue } from './CallQueue';
import { VideoPanel } from './VideoPanel';
import { KioskList } from './KioskList';
import { EventLog } from './EventLog';

export function OperatorPanel() {
  const { socket, pendingCalls, activeCall, addLog, setActiveCall, removePendingCall } = useSocket();
  const webRTC = useWebRTC();
  const [toastCall, setToastCall] = useState<any>(null);

  const webRTCRef = useRef(webRTC);
  webRTCRef.current = webRTC;
  const activeCallIdRef = useRef<string | null>(null);
  const setActiveCallRef = useRef(setActiveCall);
  setActiveCallRef.current = setActiveCall;
  const addLogRef = useRef(addLog);
  addLogRef.current = addLog;

  // Toast for new incoming calls
  useEffect(() => {
    if (pendingCalls.size === 0) return;
    const latest = Array.from(pendingCalls.values()).pop();
    setToastCall(latest);
    const t = setTimeout(() => setToastCall(null), 30000);
    return () => clearTimeout(t);
  }, [pendingCalls.size]);

  // WebRTC events — stable, no deps on webRTC
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
      await webRTCRef.current.getLocalStream();
      socket?.emit('call:accept', { callId, buildingId: call.buildingId });
      activeCallIdRef.current = callId;
      setActiveCall({ ...call });
      removePendingCall(callId);
      addLog('CALL', `Llamada aceptada: ${call.buildingName}`);
    },
    [socket, pendingCalls, setActiveCall, removePendingCall, addLog],
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
    for (const [id, c] of pendingCalls) {
      if (c.buildingId === activeCall.buildingId) removePendingCall(id);
    }
    addLog('END', `Llamada finalizada: ${activeCall.buildingName}`);
  }, [socket, activeCall, pendingCalls, webRTC, setActiveCall, removePendingCall, addLog]);

  return (
    <div className="panel-layout">
      <div className="panel-sidebar">
        <CallQueue
          pendingCalls={pendingCalls}
          onAccept={handleAcceptCall}
        />
        <KioskList />
      </div>
      <div className="panel-main">
        <VideoPanel
          activeCall={activeCall}
          remoteStream={webRTC.remoteStream}
          localStream={webRTC.localStream}
          isMuted={webRTC.isMuted}
          onOpenDoor={handleOpenDoor}
          onToggleMute={webRTC.toggleMute}
          onEndCall={handleEndCall}
        />
      </div>
      <div className="panel-log">
        <EventLog />
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
                removePendingCall(toastCall.callId);
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
