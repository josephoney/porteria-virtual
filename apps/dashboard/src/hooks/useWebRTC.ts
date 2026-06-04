import { useState, useRef, useCallback } from 'react';
import { CONFIG } from '../config';

export function useWebRTC() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const getLocalStream = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn('[WebRTC-D] getUserMedia not available.');
        return null;
      }
      console.log('[WebRTC-D] Requesting camera/microphone...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log('[WebRTC-D] Local stream obtained, tracks:', stream.getTracks().length);
      setLocalStream(stream);
      return stream;
    } catch (e) {
      console.error('[WebRTC-D] Error accessing camera/microphone:', e);
      return null;
    }
  }, []);

  const createPeerConnection = useCallback(() => {
    console.log('[WebRTC-D] Creating PeerConnection');
    const pc = new RTCPeerConnection({
      iceServers: CONFIG.ICE_SERVERS as unknown as RTCIceServer[],
    });

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC-D] ICE state:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC-D] Connection state:', pc.connectionState);
    };

    pc.onsignalingstatechange = () => {
      console.log('[WebRTC-D] Signaling state:', pc.signalingState);
    };

    pc.ontrack = ({ streams }) => {
      console.log('[WebRTC-D] Remote track received, streams:', streams.length);
      setRemoteStream(streams[0]);
    };

    pcRef.current = pc;
    return pc;
  }, []);

  const handleOffer = useCallback(
    async (socket: any, callId: string, offer: RTCSessionDescriptionInit) => {
      console.log('[WebRTC-D] Offer received for callId:', callId);
      const pc = createPeerConnection();
      if (localStream) {
        const tracks = localStream.getTracks();
        console.log('[WebRTC-D] Adding', tracks.length, 'local tracks');
        tracks.forEach((track) => {
          console.log('[WebRTC-D]   Track:', track.kind, track.label);
          pc.addTrack(track, localStream);
        });
      } else {
        console.warn('[WebRTC-D] No local stream — answering without tracks');
      }

      pc.ontrack = ({ streams }) => {
        console.log('[WebRTC-D] Remote track received, streams:', streams.length);
        setRemoteStream(streams[0]);
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          console.log('[WebRTC-D] Local ICE candidate:', candidate.type);
          socket.emit('webrtc:ice-candidate', { callId, candidate });
        } else {
          console.log('[WebRTC-D] ICE gathering complete');
        }
      };

      console.log('[WebRTC-D] Setting remote description from offer...');
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('[WebRTC-D] Creating answer...');
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      console.log('[WebRTC-D] Answer created, sending...');
      socket.emit('webrtc:answer', { callId, answer });
      console.log('[WebRTC-D] Answer sent to signaling server');
    },
    [localStream, createPeerConnection],
  );

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    try {
      await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC-D] Remote ICE candidate added');
    } catch (e) {
      console.error('[WebRTC-D] Error adding ICE candidate:', e);
    }
  }, []);

  const cleanupPeer = useCallback(() => {
    console.log('[WebRTC-D] Cleaning up peer connection');
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
    handleOffer,
    handleIceCandidate,
    cleanupPeer,
    toggleMute,
  };
}
