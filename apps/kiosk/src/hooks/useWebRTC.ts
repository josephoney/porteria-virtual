import { useState, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { CONFIG } from '../config';

// Constraint de audio para el kiosk: ganancia automatica + cancelacion
// de eco + reduccion de ruido. autoGainControl compensa microfono suave.
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
};

export function useWebRTC() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [deviceSummary, setDeviceSummary] = useState<string>('');
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());

  const scanDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      const audioDevices = devices.filter((d) => d.kind === 'audioinput');
      const outputDevices = devices.filter((d) => d.kind === 'audiooutput');

      const summaryLines: string[] = [];
      summaryLines.push(`Video: ${videoDevices.length} | Mic: ${audioDevices.length} | Speaker: ${outputDevices.length}`);
      // Try a quick getUserMedia({ audio: true }) to see if labels become available
      let gumAudioOk = '?';
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        testStream.getTracks().forEach((t) => t.stop());
        gumAudioOk = 'OK';
      } catch (e) {
        gumAudioOk = `FAIL: ${(e as Error).name}`;
      }
      summaryLines.push(`gUM audio test: ${gumAudioOk}`);

      // Re-enumerate to get labels after gUM
      const freshDevices = await navigator.mediaDevices.enumerateDevices();
      for (const d of freshDevices) {
        const label = d.label || '(sin label)';
        const id = d.deviceId.substring(0, 8);
        summaryLines.push(`  ${d.kind}: ${label} [${id}…]`);
      }
      const summary = summaryLines.join('\n');
      console.log('[WebRTC] Device scan:\n' + summary);
      setDeviceSummary(summary);
    } catch (e) {
      console.error('[WebRTC] Device scan failed:', e);
    }
  }, []);

  const getLocalStream = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      const audioDevices = devices.filter((d) => d.kind === 'audioinput');
      const outputDevices = devices.filter((d) => d.kind === 'audiooutput');

      const summaryLines: string[] = [];
      summaryLines.push(`Video: ${videoDevices.length} | AudioIn: ${audioDevices.length} | AudioOut: ${outputDevices.length}`);
      for (const d of devices) {
        const label = d.label || '(sin label)';
        const id = d.deviceId.substring(0, 8);
        summaryLines.push(`  ${d.kind}: ${label} [${id}…]`);
      }
      const summary = summaryLines.join('\n');
      console.log('[WebRTC] Device enumeration:\n' + summary);
      setDeviceSummary(summary);

      if (!navigator.mediaDevices?.getUserMedia) {
        console.warn('[WebRTC] getUserMedia not available (insecure context).');
        return null;
      }

      const constraints: MediaStreamConstraints[] = [];
      if (videoDevices.length > 0 && audioDevices.length > 0) {
        constraints.push(
          { video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: AUDIO_CONSTRAINTS },
          { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: AUDIO_CONSTRAINTS },
          { video: { width: { ideal: 640 }, height: { ideal: 480 } }, audio: AUDIO_CONSTRAINTS },
          { video: true, audio: AUDIO_CONSTRAINTS },
        );
      }
      if (videoDevices.length > 0) {
        constraints.push({ video: true, audio: false });
      }
      // Always try audio capture — enumerateDevices() can miss the default mic
      constraints.push({ audio: AUDIO_CONSTRAINTS });

      for (const c of constraints) {
        try {
          console.log('[WebRTC] Trying constraints:', JSON.stringify(c));
          const stream = await navigator.mediaDevices.getUserMedia(c);
          const videoTrack = stream.getVideoTracks()[0];
          const settings = videoTrack?.getSettings();
          console.log(
            '[WebRTC] ✓ SUCCESS — resolution:',
            settings?.width,
            'x',
            settings?.height,
            '| tracks:',
            stream.getTracks().length,
            '| video:',
            videoTrack?.label,
            '| audioTracks:',
            stream.getAudioTracks().length,
          );
          stream
            .getAudioTracks()
            .forEach((t) => console.log('[WebRTC]   Audio track:', t.label, 'enabled:', t.enabled, 'readyState:', t.readyState, 'muted:', t.muted));
          setLocalStream(stream);
          return stream;
        } catch (e) {
          console.warn('[WebRTC] ✗ Failed:', (e as DOMException).name, '—', (e as DOMException).message?.substring(0, 120));
          if ((e as DOMException & { constraint?: string }).constraint) {
            console.warn('[WebRTC]   Constraint error on:', (e as DOMException & { constraint?: string }).constraint);
          }
        }
      }

      console.warn('[WebRTC] No media constraints succeeded — running receive-only');
      return null;
    } catch (e) {
      console.error('[WebRTC] Error enumerating devices:', e);
      return null;
    }
  }, []);

  const createPeerConnection = useCallback(
    (socket: Socket, callId: string) => {
      console.log('[WebRTC] Creating PeerConnection for callId:', callId);
      const pc = new RTCPeerConnection({
        iceServers: CONFIG.ICE_SERVERS as unknown as RTCIceServer[],
      });

      pc.addEventListener('track', (event) => {
        const { track, streams } = event;
        console.log('[WebRTC] Remote track:', track.kind, track.label, 'streams:', streams.length);
        if (event.track.kind === 'audio') {
          console.log('[WebRTC]   Audio — enabled:', track.enabled, 'muted:', track.muted, 'readyState:', track.readyState);
        }
        remoteStreamRef.current.addTrack(track);
        setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
        console.log('[WebRTC] Remote stream now has', remoteStreamRef.current.getTracks().length, 'tracks');
      });

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
    async (socket: Socket, callId: string) => {
      console.log('[WebRTC] Creating offer for callId:', callId);
      const stream = localStream;
      const pc = createPeerConnection(socket, callId);

      const hasVideo = stream ? stream.getVideoTracks().length > 0 : false;
      const hasAudio = stream ? stream.getAudioTracks().length > 0 : false;

      if (stream) {
        const tracks = stream.getTracks();
        console.log('[WebRTC] Adding', tracks.length, 'local tracks (video:', hasVideo, 'audio:', hasAudio, ')');
        tracks.forEach((track) => {
          console.log('[WebRTC]   Track:', track.kind, track.label);
          pc.addTrack(track, stream);
        });
      } else {
        console.log('[WebRTC] No local stream');
      }

      if (!hasVideo) {
        console.log('[WebRTC] No local video — adding recvonly video transceiver');
        pc.addTransceiver('video', { direction: 'recvonly' });
      }
      if (!hasAudio) {
        console.log('[WebRTC] No local audio — adding recvonly audio transceiver');
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
    remoteStreamRef.current.getTracks().forEach((t) => t.stop());
    remoteStreamRef.current = new MediaStream();
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
    deviceSummary,
    getLocalStream,
    scanDevices,
    createAndSendOffer,
    handleAnswer,
    handleIceCandidate,
    cleanupPeer,
    toggleMute,
  };
}
