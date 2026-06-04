import { createContext, useState, useEffect, useRef, useContext, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { CONFIG } from '../config';

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
    });

    s.on('call:taken', ({ callId }: { callId: string }) => {
      removePendingCall(callId);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
      addLog('SYS', 'Conexión perdida. Reconectando…');
    });

    s.on('error', (msg: string) => console.error('[Server error]', msg));

    return () => {
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
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
