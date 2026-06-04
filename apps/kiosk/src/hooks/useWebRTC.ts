import { useState, useRef, useCallback } from 'react';
import { CONFIG } from '../config';

export function useWebRTC() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const getLocalStream = useCallback(async () => {
    try {
      // First check what devices are available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      console.log('[WebRTC] Available video devices:', videoDevices.length, videoDevices.map(d => d.label));

      const audioDevices = devices.filter(d => d.kind === 'audioinput');
      console.log('[WebRTC] Available audio devices:', audioDevices.length, audioDevices.map(d => d.label));

      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn('[WebRTC] getUserMedia not available (insecure context).');
        return null;
      }

      // Try from highest to lowest resolution — first match wins
      const constraints = [
        { video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: true },
        { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true },
        { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: true },
        { video: true, audio: true },
        { video: true, audio: false },
      ];

      for (const c of constraints) {
        try {
          console.log('[WebRTC] Trying constraints:', JSON.stringify(c));
          const stream = await navigator.mediaDevices.getUserMedia(c);
          const videoTrack = stream.getVideoTracks()[0];
          const settings = videoTrack?.getSettings();
          console.log('[WebRTC] ✓ SUCCESS — resolution:', settings?.width, 'x', settings?.height, 
                      '| tracks:', stream.getTracks().length,
                      '| video:', videoTrack?.label);
          setLocalStream(stream);
          return stream;
        } catch (e: any) {
          console.warn('[WebRTC] ✗ Failed:', e.message?.substring(0, 50));
        }
      }

      console.error('[WebRTC] All getUserMedia attempts failed.');
      return null;
    } catch (e) {
      console.error('[WebRTC] Error enumerating devices:', e);
      return null;
    }
  }, []);

  const createPeerConnection = useCallback(
    (socket: any, callId: string) => {
      console.log('[WebRTC] Creating PeerConnection for callId:', callId);
      const pc = new RTCPeerConnection({
        iceServers: CONFIG.ICE_SERVERS as unknown as RTCIceServer[],
      });

      pc.ontrack = ({ streams }) => {
        console.log('[WebRTC] Remote track received, streams:', streams.length);
        setRemoteStream(streams[0]);
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          console.log('[WebRTC] Local ICE candidate:', candidate.type);
          socket.emit('webrtc:ice-candidate', { callId, candidate });
        } else {
          console.log('[WebRTC] ICE gathering complete');
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('[WebRTC] ICE state:', pc.iceConnectionState);
      };

      pc.onconnectionstatechange = () => {
        console.log('[WebRTC] Connection state:', pc.connectionState);
      };

      pc.onsignalingstatechange = () => {
        console.log('[WebRTC] Signaling state:', pc.signalingState);
      };

      pcRef.current = pc;
      return pc;
    },
    [],
  );

  const createAndSendOffer = useCallback(
    async (socket: any, callId: string) => {
      console.log('[WebRTC] Creating offer for callId:', callId);
      let stream = localStream;
      if (!stream && navigator.mediaDevices?.getUserMedia) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          setLocalStream(stream);
        } catch (e) {
          console.error('[WebRTC] Error getting media for offer:', e);
        }
      }
      const pc = createPeerConnection(socket, callId);
      if (stream) {
        const tracks = stream.getTracks();
        console.log('[WebRTC] Adding', tracks.length, 'local tracks');
        tracks.forEach((track) => {
          console.log('[WebRTC]   Track:', track.kind, track.label);
          pc.addTrack(track, stream);
        });
      } else {
        // Add receive-only transceivers so the SDP includes media sections
        // This allows receiving video/audio from the dashboard even without local camera
        console.log('[WebRTC] No local stream — adding recvonly transceivers for video+audio');
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('[WebRTC] Offer created and set as local description');
      socket.emit('webrtc:offer', { callId, offer });
      console.log('[WebRTC] Offer sent to signaling server');
    },
    [localStream, createPeerConnection],
  );

  const handleAnswer = useCallback(async (answer: RTCSessionDescriptionInit) => {
    console.log('[WebRTC] Answer received, setting remote description...');
    try {
      await pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('[WebRTC] Remote description set from answer');
    } catch (e) {
      console.error('[WebRTC] Error setting remote description:', e);
    }
  }, []);

  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    try {
      await pcRef.current?.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[WebRTC] Remote ICE candidate added, type:', candidate.candidate?.substring(0, 30));
    } catch (e) {
      console.error('[WebRTC] Error adding ICE candidate:', e);
    }
  }, []);

  const cleanupPeer = useCallback(() => {
    console.log('[WebRTC] Cleaning up peer connection');
    pcRef.current?.close();
    pcRef.current = null;
    setRemoteStream(null);
  }, []);

  const toggleMute = useCallback(() => {
    if (!localStream) return;
    const muted = !isMuted;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    setIsMuted(muted);
    console.log('[WebRTC] Mute toggled:', muted);
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
