import { useEffect, useState, useCallback, useRef } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useWebRTC } from '../../hooks/useWebRTC';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

export function IncomingCallOverlay() {
  const { socket, pendingCalls, activeCall, setActiveCall, removePendingCall, stopRing, addLog } = useSocket();
  const webRTC = useWebRTC();

  const [toastCall, setToastCall] = useState<any>(null);
  const [minimized, setMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: -1, y: -1 });
  const dragRef = useRef({ startX: 0, startY: 0, origX: 0, origY: 0 });
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const webRTCRef = useRef(webRTC);
  webRTCRef.current = webRTC;
  const activeCallIdRef = useRef<string | null>(null);
  const addLogRef = useRef(addLog);
  addLogRef.current = addLog;

  useEffect(() => {
    if (activeCall && pos.x === -1) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setPos({ x: Math.max(20, (w - 640) / 2), y: Math.max(60, (h - 420) / 2) });
    }
  }, [activeCall]);

  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = webRTC.remoteStream;
  }, [webRTC.remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = webRTC.localStream;
  }, [webRTC.localStream]);

  useEffect(() => {
    if (pendingCalls.size === 0) { setToastCall(null); return; }
    const latest = Array.from(pendingCalls.values()).pop();
    setToastCall(latest);
    const t = setTimeout(() => setToastCall(null), 30000);
    return () => clearTimeout(t);
  }, [pendingCalls.size]);

  useEffect(() => {
    if (!socket) return;
    const onOffer = async ({ callId, offer }: any) => { await webRTCRef.current.handleOffer(socket, callId, offer); };
    const onIceCandidate = async ({ candidate }: any) => { await webRTCRef.current.handleIceCandidate(candidate); };
    const onCallEnded = () => { activeCallIdRef.current = null; webRTCRef.current.cleanupPeer(); setActiveCall(null); setMinimized(false); };
    socket.on('webrtc:offer', onOffer);
    socket.on('webrtc:ice-candidate', onIceCandidate);
    socket.on('call:ended', onCallEnded);
    return () => {
      socket.off('webrtc:offer', onOffer);
      socket.off('webrtc:ice-candidate', onIceCandidate);
      socket.off('call:ended', onCallEnded);
    };
  }, [socket]);

  const handleAcceptCall = useCallback(async (callId: string) => {
    const call = pendingCalls.get(callId);
    if (!call) return;
    stopRing();
    await webRTCRef.current.getLocalStream();
    socket?.emit('call:accept', { callId, buildingId: call.buildingId });
    activeCallIdRef.current = callId;
    setActiveCall({ ...call });
    removePendingCall(callId);
    setMinimized(false);
    setToastCall(null);
  }, [socket, pendingCalls, setActiveCall, removePendingCall, stopRing]);

  const handleEndCall = useCallback(() => {
    const cid = activeCallIdRef.current;
    if (!cid || !activeCall) return;
    socket?.emit('call:end', { callId: cid });
    activeCallIdRef.current = null;
    webRTCRef.current.cleanupPeer();
    setActiveCall(null);
    setMinimized(false);
  }, [socket, activeCall, setActiveCall]);

  const handleOpenDoor = useCallback(() => {
    const cid = activeCallIdRef.current;
    if (!cid || !activeCall) return;
    socket?.emit('door:open', { callId: cid, buildingId: activeCall.buildingId });
    addLogRef.current('DOOR', `Puerta abierta: ${activeCall.buildingName}`);
  }, [socket, activeCall]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  }, [pos]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setPos({ x: dragRef.current.origX + e.clientX - dragRef.current.startX, y: dragRef.current.origY + e.clientY - dragRef.current.startY });
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const resetPos = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    setPos({ x: Math.max(20, (w - 640) / 2), y: Math.max(60, (h - 420) / 2) });
  };

  const showOverlay = activeCall && !minimized;
  const showPiP = activeCall && minimized;

  return (
    <>
      {/* ── Incoming call toast ── */}
      {toastCall && !activeCall && (
        <div className="fixed top-20 right-6 z-[10000] bg-card border border-border rounded-lg shadow-lg p-5 min-w-[300px]">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Llamada entrante</p>
          <p className="text-lg font-bold mb-1">{toastCall.buildingName}</p>
          {toastCall.visitor?.known && (
            <p className="text-sm text-muted-foreground mb-3">Visitante: {toastCall.visitor.name}</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleAcceptCall(toastCall.callId)}>Contestar</Button>
            <Button variant="outline" size="sm" onClick={() => { socket?.emit('call:end', { callId: toastCall.callId }); removePendingCall(toastCall.callId); stopRing(); setToastCall(null); }}>Ignorar</Button>
          </div>
        </div>
      )}

      {/* ── Active call overlay ── */}
      {showOverlay && activeCall && (
        <div
          onMouseDown={onMouseDown}
          className="fixed z-[9999] bg-card border border-border rounded-lg shadow-2xl overflow-hidden select-none"
          style={{ left: pos.x, top: pos.y, width: 640, cursor: dragging ? 'grabbing' : 'grab' }}
        >
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span className="text-sm font-semibold">{activeCall.buildingName}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleOpenDoor}>🚪 Abrir</Button>
              <Button variant="ghost" size="sm" onClick={() => webRTC.toggleMute()}>
                {webRTC.isMuted ? '🔇' : '🎤'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setMinimized(true); resetPos(); }}>─</Button>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleEndCall}>✕</Button>
            </div>
          </div>
          <div className="relative bg-black min-h-[360px]">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-[360px] object-contain bg-black" />
            {webRTC.localStream && (
              <video ref={localVideoRef} autoPlay playsInline muted
                className="absolute bottom-2 right-2 w-[140px] h-[100px] object-cover rounded-lg border-2 border-ring bg-[#111]" />
            )}
          </div>
        </div>
      )}

      {/* ── Minimized PiP ── */}
      {showPiP && activeCall && (
        <Badge
          className="fixed bottom-4 right-4 z-[10000] px-3 py-2 text-sm cursor-pointer border border-primary"
          variant="secondary"
          onClick={() => { setMinimized(false); resetPos(); }}
        >
          📹 {activeCall.buildingName}
        </Badge>
      )}
    </>
  );
}
