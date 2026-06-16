import type { Socket } from 'socket.io';

export interface VisitorData {
  known: boolean;
  name?: string;
  similarity?: number;
}

export interface KioskData {
  socketId: string;
  buildingName: string;
  status: 'idle' | 'calling' | 'in-call';
  registeredAt: string;
  lastVisitor?: VisitorData;
}

export interface OperatorData {
  operatorId: string;
  name: string;
}

export interface CallData {
  kioskSocketId: string;
  operatorSocketId: string;
  buildingId: string;
  startedAt: number;
}

export interface KioskStatus {
  buildingId: string;
  buildingName: string;
  status: string;
}

export interface TypedSocket extends Socket {
  data: {
    role?: 'kiosk' | 'operator';
    buildingId?: string;
    operatorId?: string;
  };
}

export interface ServerToClientEvents {
  'kiosk:registered': (data: { buildingId: string; serverTime: number }) => void;
  'call:waiting': (data: { callId: string }) => void;
  'call:accepted': (data: { callId: string; operatorName: string }) => void;
  'call:ended': (data: { callId: string; reason?: string }) => void;
  'call:ready': (data: { callId: string; buildingId: string; buildingName: string }) => void;
  'webrtc:answer': (data: { callId: string; answer: RTCSessionDescriptionInit }) => void;
  'webrtc:ice-candidate': (data: { callId: string; candidate: RTCIceCandidateInit }) => void;
  'door:open': (data: { authorizedBy: string; timestamp: number }) => void;

  'operator:registered': (data: { kiosks: KioskStatus[]; serverTime: number }) => void;
  'kiosks:update': (data: KioskStatus[]) => void;
  'call:incoming': (data: {
    callId: string;
    buildingId: string;
    buildingName: string;
    visitor: VisitorData | null;
    timestamp: number;
  }) => void;
  'call:taken': (data: { callId: string; buildingId: string }) => void;
  'webrtc:offer': (data: { callId: string; offer: RTCSessionDescriptionInit }) => void;
  'visitor:identified': (data: {
    buildingId: string;
    buildingName: string;
    visitor: VisitorData;
    timestamp: number;
  }) => void;

  error: (message: string) => void;
}

export interface ClientToServerEvents {
  'kiosk:register': (data: { buildingId: string; buildingName: string }) => void;
  'call:request': () => void;
  'call:end': (data: { callId: string; buildingId?: string }) => void;
  'webrtc:offer': (data: { callId: string; offer: RTCSessionDescriptionInit }) => void;
  'webrtc:ice-candidate': (data: { callId: string; candidate: RTCIceCandidateInit }) => void;
  'visitor:identified': (data: { buildingId: string; visitor: VisitorData }) => void;

  'operator:register': (data: { operatorId: string; name: string }) => void;
  'call:accept': (data: { callId: string; buildingId: string }) => void;
  'webrtc:answer': (data: { callId: string; answer: RTCSessionDescriptionInit }) => void;
  'door:open': (data: { callId: string; buildingId: string }) => void;
  'relay:trigger': (data: { buildingId: string; relayIndex: number }) => void;
}
