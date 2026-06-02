import { useState, useRef, useCallback } from 'react';
import { CONFIG } from '../config';

export function useWebRTC() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const getLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (e) {
      console.error('Error accessing camera/microphone:', e);
      return null;
    }
  }, []);

  const createPeerConnection = useCallback(
    (socket: any, callId: string) => {
      const pc = new RTCPeerConnection({
        iceServers: CONFIG.ICE_SERVERS as unknown as RTCIceServer[],
      });

      localStream?.getTracks().forEach((track) => pc.addTrack(track, localStream));

      pc.ontrack = ({ streams }) => {
        setRemoteStream(streams[0]);
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          socket.emit('webrtc:ice-candidate', { callId, candidate });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] State:', pc.connectionState);
      };

      pcRef.current = pc;
      return pc;
    },
    [localStream],
  );

  const createAndSendOffer = useCallback(
    async (socket: any, callId: string) => {
      const pc = createPeerConnection(socket, callId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', { callId, offer });
    },
    [createPeerConnection],
  );

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    try {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (e) {
      console.error('Error setting remote description:', e);
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    try {
      await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      // Ignore ICE candidate errors
    }
  }, []);

  const cleanupPeer = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    setRemoteStream(null);
  }, []);

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    const muted = !isMuted;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    setIsMuted(muted);
  }, [localStream, isMuted]);

  return {
    localStream,
    remoteStream,
    isMuted,
    getLocalStream,
    createAndSendOffer,
    handleAnswer,
    handleIceCandidate,
    cleanupPeer,
    toggleMute,
  };
}
