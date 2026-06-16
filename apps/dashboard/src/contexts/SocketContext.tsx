import { createContext, useState, useEffect, useRef, useContext, useCallback, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { CONFIG } from '../config';
import {
  getRingtoneDefinition,
  createRingPlayer,
  previewRingtone as playPreview,
  DEFAULT_RINGTONE_ID,
} from '../lib/ringtones';

interface KioskInfo {
  buildingId: string;
  buildingName: string;
  status: string;
}

interface CallInfo {
  callId: string;
  buildingId: string;
  buildingName: string;
  visitor?: { name: string; known: boolean; similarity: number; photo?: string } | null;
  timestamp: number;
}

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  kiosks: KioskInfo[];
  pendingCalls: Map<string, CallInfo>;
  activeCall: CallInfo | null;
  eventLog: Array<{ type: string; message: string; timestamp: Date }>;
  addLog: (type: string, message: string) => void;
  setActiveCall: (call: CallInfo | null) => void;
  removePendingCall: (callId: string) => void;
  setKiosks: (k: KioskInfo[]) => void;
  stopRing: () => void;
  selectedRingtoneId: string;
  setRingtone: (id: string) => void;
  previewRingtone: (id: string) => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  kiosks: [],
  pendingCalls: new Map(),
  activeCall: null,
  eventLog: [],
  addLog: () => {},
  setActiveCall: () => {},
  removePendingCall: () => {},
  setKiosks: () => {},
  stopRing: () => {},
  selectedRingtoneId: DEFAULT_RINGTONE_ID,
  setRingtone: () => {},
  previewRingtone: () => {},
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [kiosks, setKiosks] = useState<KioskInfo[]>([]);
  const [pendingCalls, setPendingCalls] = useState<Map<string, CallInfo>>(new Map());
  const [activeCall, setActiveCall] = useState<CallInfo | null>(null);
  const [eventLog, setEventLog] = useState<Array<{ type: string; message: string; timestamp: Date }>>([]);
  const socketRef = useRef<Socket | null>(null);

  const addLog = (type: string, message: string) => {
    setEventLog((prev) => [{ type, message, timestamp: new Date() }, ...prev].slice(0, 100));
  };

  const removePendingCall = (callId: string) => {
    setPendingCalls((prev) => {
      const next = new Map(prev);
      next.delete(callId);
      return next;
    });
  };

  // Ringtone selection
  const [selectedRingtoneId, setSelectedRingtoneId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('ringtone');
      if (saved && getRingtoneDefinition(saved)) return saved;
    } catch { /* localStorage unavailable */ }
    return DEFAULT_RINGTONE_ID;
  });

  const setRingtone = useCallback((id: string) => {
    if (!getRingtoneDefinition(id)) return;
    setSelectedRingtoneId(id);
    try {
      localStorage.setItem('ringtone', id);
    } catch { /* localStorage unavailable */ }
  }, []);

  const previewRingtone = useCallback((id: string) => {
    const def = getRingtoneDefinition(id);
    if (def) playPreview(def);
  }, []);

  // Ring sound using ringtone player
  const ringPlayerRef = useRef<{ start: () => boolean; stop: () => void } | null>(
    null,
  );
  const selectedRingtoneIdRef = useRef(selectedRingtoneId);
  selectedRingtoneIdRef.current = selectedRingtoneId;

  const startRing = () => {
    if (ringPlayerRef.current) return;
    const def = getRingtoneDefinition(selectedRingtoneIdRef.current);
    if (!def) return;
    const player = createRingPlayer(def);
    if (!player.start()) return;
    ringPlayerRef.current = player;
  };

  const stopRing = useCallback(() => {
    if (ringPlayerRef.current) {
      ringPlayerRef.current.stop();
      ringPlayerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!user || !token) return;

    const s = io(CONFIG.SIGNALING_URL, { transports: ['websocket'] });
    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      setIsConnected(true);
      addLog('SYS', 'Conectado al servidor de señalización');
      s.emit('operator:register', {
        operatorId: user.id,
        name: user.name,
      });
    });

    s.on('operator:registered', ({ kiosks: list }: { kiosks: KioskInfo[] }) => {
      setKiosks(list);
      addLog('SYS', `Operador registrado. Kiosks activos: ${list.length}`);
    });

    s.on('kiosks:update', (list: KioskInfo[]) => {
      setKiosks(list);
    });

    s.on('call:incoming', (call: CallInfo) => {
      setPendingCalls((prev) => {
        const next = new Map(prev);
        next.set(call.callId, { ...call, timestamp: Date.now() });
        return next;
      });
      addLog('CALL', `Llamada entrante: ${call.buildingName}${call.visitor?.known ? ' — ' + call.visitor.name : ''}`);
      startRing();
    });

    s.on('call:taken', ({ callId }: { callId: string }) => {
      removePendingCall(callId);
      stopRing();
    });

    s.on('call:ended', ({ callId, reason }: { callId: string; reason?: string }) => {
      removePendingCall(callId);
      stopRing();
      if (reason === 'cancelled') {
        addLog('END', 'Llamada cancelada desde el kiosk');
      } else if (reason === 'timeout') {
        addLog('END', 'Llamada expirada (sin respuesta)');
      }
    });

    s.on('disconnect', () => {
      setIsConnected(false);
      addLog('SYS', 'Conexión perdida. Reconectando…');
    });

    s.on('error', (msg: string) => console.error('[Server error]', msg));

    return () => {
      stopRing();
      s.disconnect();
    };
  }, [user, token]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        kiosks,
        pendingCalls,
        activeCall,
        eventLog,
        addLog,
        setActiveCall,
        removePendingCall,
        setKiosks,
        stopRing,
        selectedRingtoneId,
        setRingtone,
        previewRingtone,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
