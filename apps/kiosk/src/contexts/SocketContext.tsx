import { createContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { CONFIG } from '../config';

export interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

export const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = io(CONFIG.SERVER_URL, { transports: ['websocket'] });
    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      setIsConnected(true);
      s.emit('kiosk:register', {
        buildingId: CONFIG.BUILDING_ID,
        buildingName: CONFIG.BUILDING_NAME,
      });
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
