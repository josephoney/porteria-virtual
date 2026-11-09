import type { Socket } from 'socket.io';

export interface VisitorData {
  known: boolean;
  name?: string;
  similarity?: number;
}

export interface KioskData {
  socketId: string;
  kioskId: string;
  rpiId: string;
  communityId: string;
  organizationId: string;
  kioskName: string;
  status: 'idle' | 'calling' | 'in-call';
  registeredAt: string;
  lastVisitor?: VisitorData;
}

export interface OperatorData {
  operatorId: string;
  name: string;
  communityId: string | null;
  orgId: string;
  role: string;
}

export interface CallData {
  kioskSocketId: string;
  operatorSocketId: string;
  kioskId: string;
  communityId: string;
  startedAt: number;
}

export interface KioskStatus {
  kioskId: string;
  rpiId: string;
  communityId: string;
  kioskName: string;
  status: string;
}

export interface TypedSocket extends Socket {
  data: {
    role?: 'kiosk' | 'operator';
    authType?: 'kiosk' | 'operator';
    kioskId?: string;
    rpiId?: string;
    kioskName?: string;
    communityId?: string;
    organizationId?: string;
    orgId?: string;
    operatorId?: string;
    email?: string;
    membershipId?: string;
    membershipRole?: string;
  };
}

export interface ServerToClientEvents {
  'kiosk:registered': (data: { kioskId: string; communityId: string; serverTime: number }) => void;
  'call:waiting': (data: { callId: string }) => void;
  'call:accepted': (data: { callId: string; operatorName: string }) => void;
  'call:ended': (data: { callId: string; reason?: string }) => void;
  'call:ready': (data: {
    callId: string;
    kioskId: string;
    kioskRpiId: string;
    kioskName: string;
    communityId: string;
  }) => void;
  'webrtc:answer': (data: { callId: string; answer: RTCSessionDescriptionInit }) => void;
  'webrtc:ice-candidate': (data: { callId: string; candidate: RTCIceCandidateInit }) => void;
  'door:open': (data: { authorizedBy: string; timestamp: number }) => void;

  'operator:registered': (data: { kiosks: KioskStatus[]; serverTime: number }) => void;
  'kiosks:update': (data: KioskStatus[]) => void;
  'call:incoming': (data: {
    callId: string;
    kioskId: string;
    kioskRpiId: string;
    kioskName: string;
    communityId: string;
    visitor: VisitorData | null;
    timestamp: number;
  }) => void;
  'call:taken': (data: { callId: string; kioskId: string }) => void;
  'webrtc:offer': (data: { callId: string; offer: RTCSessionDescriptionInit }) => void;
  'visitor:identified': (data: {
    kioskId: string;
    kioskName: string;
    communityId: string;
    visitor: VisitorData;
    timestamp: number;
  }) => void;

  error: (message: string) => void;
}

export interface ClientToServerEvents {
  'kiosk:register': (data: { name?: string }) => void;
  'call:request': () => void;
  'call:end': (data: { callId: string; kioskId?: string }) => void;
  'webrtc:offer': (data: { callId: string; offer: RTCSessionDescriptionInit }) => void;
  'webrtc:ice-candidate': (data: { callId: string; candidate: RTCIceCandidateInit }) => void;
  'visitor:identified': (data: { kioskId?: string; visitor: VisitorData }) => void;

  'operator:register': (data: { name: string }) => void;
  'call:accept': (data: { callId: string; kioskId: string }) => void;
  'webrtc:answer': (data: { callId: string; answer: RTCSessionDescriptionInit }) => void;
  'door:open': (data: { callId: string; kioskId: string }) => void;
  'relay:trigger': (data: { kioskId: string; relayIndex: number }) => void;
}
