import { useEffect, useState, useRef } from 'react';
import { SocketProvider } from './contexts/SocketContext';
import { useSocket } from './hooks/useSocket';
import { useWebRTC } from './hooks/useWebRTC';
import { useKioskState } from './hooks/useKioskState';
import { TopBar } from './components/TopBar';
import { IdleScreen } from './components/IdleScreen';
import { CallingScreen } from './components/CallingScreen';
import { InCallScreen } from './components/InCallScreen';
import { DoorFlash } from './components/DoorFlash';
import './App.css';

function KioskContent() {
  const { isConnected, socketRef: ctxSocketRef, socket } = useSocket();
  const webRTC = useWebRTC();
  const kiosk = useKioskState();
  const [doorFlashTrigger, setDoorFlashTrigger] = useState(0);

  const [debugMsg, setDebugMsg] = useState('');

  const webRTCRef = useRef(webRTC);
  webRTCRef.current = webRTC;
  const kioskRef = useRef(kiosk);
  kioskRef.current = kiosk;
  const callIdRef = useRef<string | null>(null);

  function emit(event: string, data: any) {
    const s = ctxSocketRef.current;
    s?.emit(event, data);
    setDebugMsg(`${new Date().toLocaleTimeString()} → ${event}`);
  }

  function doCall() {
    emit('call:request', {});
    webRTCRef.current.getLocalStream().catch((e) => console.error('Camera error:', e));
  }

  function doCancel() {
    const cid = callIdRef.current;
    console.log('[Kiosk] doCancel, callId:', cid);
    if (cid) {
      emit('call:end', { callId: cid });
    }
    callIdRef.current = null;
    webRTCRef.current.cleanupPeer();
    kioskRef.current.resetCall();
  }

  function doHangUp() {
    const cid = callIdRef.current;
    console.log('[Kiosk] doHangUp, callId:', cid);
    if (cid) {
      emit('call:end', { callId: cid });
    }
    callIdRef.current = null;
    webRTCRef.current.cleanupPeer();
    kioskRef.current.resetCall();
  }

  // Wire socket events
  useEffect(() => {
    const s = ctxSocketRef.current;
    if (!s) return;

    function onRegistered() { kioskRef.current.setStatusDot('connected'); }
    function onCallWaiting({ callId }: { callId: string }) {
      callIdRef.current = callId;
      kioskRef.current.startCall(callId);
      setDebugMsg(`${new Date().toLocaleTimeString()} ← call:waiting ${callId}`);
    }
    async function onCallAccepted({ callId, operatorName }: { callId: string; operatorName: string }) {
      kioskRef.current.acceptCall(operatorName);
      await webRTCRef.current.createAndSendOffer(s, callId);
    }
    async function onAnswer({ answer }: { answer: RTCSessionDescriptionInit }) {
      await webRTCRef.current.handleAnswer(answer);
    }
    async function onIceCandidate({ candidate }: { candidate: RTCIceCandidateInit }) {
      await webRTCRef.current.handleIceCandidate(candidate);
    }
    function onDoorOpen() { setDoorFlashTrigger((n) => n + 1); }
    function onCallEnded({ callId, reason }: { callId?: string; reason?: string }) {
      setDebugMsg(`${new Date().toLocaleTimeString()} ← call:ended ${callId} (${reason || 'no reason'}) currentId:${callIdRef.current}`);
      if (callId && callIdRef.current !== null && callIdRef.current !== callId) {
        setDebugMsg((d) => d + ' IGNORED (stale)');
        return;
      }
      callIdRef.current = null;
      webRTCRef.current.cleanupPeer();
      kioskRef.current.resetCall();
    }

    s.on('kiosk:registered', onRegistered);
    s.on('call:waiting', onCallWaiting);
    s.on('call:accepted', onCallAccepted);
    s.on('webrtc:answer', onAnswer);
    s.on('webrtc:ice-candidate', onIceCandidate);
    s.on('door:open', onDoorOpen);
    s.on('call:ended', onCallEnded);

    return () => {
      s.off('kiosk:registered', onRegistered);
      s.off('call:waiting', onCallWaiting);
      s.off('call:accepted', onCallAccepted);
      s.off('webrtc:answer', onAnswer);
      s.off('webrtc:ice-candidate', onIceCandidate);
      s.off('door:open', onDoorOpen);
      s.off('call:ended', onCallEnded);
    };
  }, [isConnected, socket]);

  return (
    <div id="app">
      <TopBar statusDot={kiosk.statusDot} visible={isConnected || kiosk.statusDot !== ''} />

      {kiosk.screen === 'idle' && (
        <>
          <IdleScreen onCall={doCall} />
          <div style={{ fontSize: 11, color: isConnected ? '#00e5a0' : '#ff3b5c', marginTop: 8, letterSpacing: 1 }}>
            {isConnected ? '✓ Conectado' : '✗ Desconectado'}
          </div>
        </>
      )}
      <div style={{ position: 'fixed', bottom: 8, left: 8, fontSize: 10, color: '#5a6172', fontFamily: 'monospace', maxWidth: '90vw', wordBreak: 'break-all' }}>
        {debugMsg}
      </div>
      {kiosk.screen === 'calling' && <CallingScreen onCancel={doCancel} />}
      {kiosk.screen === 'in-call' && (
        <InCallScreen
          remoteStream={webRTC.remoteStream}
          localStream={webRTC.localStream}
          operatorName={kiosk.operatorName}
          callTimer={kiosk.callTimer}
          isMuted={webRTC.isMuted}
          onMute={webRTC.toggleMute}
          onHangUp={doHangUp}
        />
      )}

      <DoorFlash trigger={doorFlashTrigger} />

      {!isConnected && (
        <div id="conn-overlay">
          <div className="spinner" />
          <div className="conn-text">Conectando al servidor…</div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <SocketProvider>
      <KioskContent />
    </SocketProvider>
  );
}
