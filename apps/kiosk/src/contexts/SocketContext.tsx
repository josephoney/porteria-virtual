import { createContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { CONFIG } from '../config';

export interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  socketRef: React.RefObject<Socket | null>;
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  socketRef: { current: null },
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    console.log('[Kiosk] Connecting to:', CONFIG.SERVER_URL);
    const s = io(CONFIG.SERVER_URL, {
      transports: ['websocket'],
      auth: { deviceToken: CONFIG.KIOSK_TOKEN },
    });
    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      console.log('[Kiosk] Socket connected, registering...');
      setIsConnected(true);
      s.emit('kiosk:register', {
        kioskId: CONFIG.BUILDING_ID,
        communityId: CONFIG.COMMUNITY_ID,
        name: CONFIG.BUILDING_NAME,
      });
    });

    s.on(
      'kiosk:registered',
      (data: { kioskId: string; communityId: string; serverTime: number }) => {
        console.log('[Kiosk] Registered:', data);
      },
    );

    s.on('disconnect', (reason: string) => {
      console.log('[Kiosk] Disconnected:', reason);
      setIsConnected(false);
    });

    s.on('connect_error', (err: Error) => {
      console.error('[Kiosk] Connection error:', err.message);
    });

    s.on('error', (msg: string) => console.error('[Kiosk] Server error:', msg));

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, socketRef }}>
      {children}
    </SocketContext.Provider>
  );
}
