import { useCallback, useEffect, useState } from 'react';
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
  const { socket, isConnected } = useSocket();
  const webRTC = useWebRTC();
  const kiosk = useKioskState();
  const [doorFlashTrigger, setDoorFlashTrigger] = useState(0);

  // Wire socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('kiosk:registered', () => {
      kiosk.setStatusDot('connected');
    });

    socket.on('call:waiting', ({ callId }: { callId: string }) => {
      kiosk.startCall(callId);
    });

    socket.on(
      'call:accepted',
      async ({ callId, operatorName }: { callId: string; operatorName: string }) => {
        kiosk.acceptCall(operatorName);
        await webRTC.createAndSendOffer(socket, callId);
      },
    );

    socket.on('webrtc:answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      await webRTC.handleAnswer(answer);
    });

    socket.on(
      'webrtc:ice-candidate',
      async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        await webRTC.handleIceCandidate(candidate);
      },
    );

    socket.on('door:open', () => {
      setDoorFlashTrigger((n) => n + 1);
    });

    socket.on('call:ended', () => {
      webRTC.cleanupPeer();
      kiosk.resetCall();
    });

    socket.on('error', (msg: string) => console.error('[Server error]', msg));

    return () => {
      socket.off('kiosk:registered');
      socket.off('call:waiting');
      socket.off('call:accepted');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
      socket.off('door:open');
      socket.off('call:ended');
      socket.off('error');
    };
  }, [socket, kiosk, webRTC]);

  const handleCall = useCallback(async () => {
    await webRTC.getLocalStream();
    socket?.emit('call:request');
  }, [socket, webRTC]);

  const handleCancel = useCallback(() => {
    if (kiosk.currentCallId) {
      socket?.emit('call:end', { callId: kiosk.currentCallId });
    }
    webRTC.cleanupPeer();
    kiosk.resetCall();
  }, [socket, kiosk, webRTC]);

  const handleHangUp = useCallback(() => {
    if (kiosk.currentCallId) {
      socket?.emit('call:end', { callId: kiosk.currentCallId });
    }
    webRTC.cleanupPeer();
    kiosk.resetCall();
  }, [socket, kiosk, webRTC]);

  return (
    <div id="app">
      <TopBar
        statusDot={kiosk.statusDot}
        visible={isConnected || kiosk.statusDot !== ''}
      />

      {kiosk.screen === 'idle' && (
        <IdleScreen onCall={handleCall} />
      )}

      {kiosk.screen === 'calling' && (
        <CallingScreen onCancel={handleCancel} />
      )}

      {kiosk.screen === 'in-call' && (
        <InCallScreen
          remoteStream={webRTC.remoteStream}
          localStream={webRTC.localStream}
          operatorName={kiosk.operatorName}
          callTimer={kiosk.callTimer}
          isMuted={webRTC.isMuted}
          onMute={webRTC.toggleMute}
          onHangUp={handleHangUp}
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
