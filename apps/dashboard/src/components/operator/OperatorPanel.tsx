import { useEffect, useCallback, useState, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { CallQueue } from './CallQueue';
import { KioskList } from './KioskList';
import { EventLog } from './EventLog';
import { OperatorCallHistory } from './OperatorCallHistory';
import { CONFIG } from '../../config';

interface RelayConfig {
  id: string;
  relayIndex: number;
  gpioPin: number;
  label: string;
  mode: 'momentary' | 'latch';
  durationMs: number | null;
  accessPointId: string | null;
}

export function OperatorPanel() {
  const { socket, pendingCalls, activeCall, setActiveCall, removePendingCall, stopRing } =
    useSocket();
  const { user, token } = useAuth();

  // Relay control state
  const [relayConfigs, setRelayConfigs] = useState<RelayConfig[]>([]);
  const [relayStates, setRelayStates] = useState<Record<number, 'ON' | 'OFF'>>({});
  const mqttSocketRef = useRef<Socket | null>(null);

  // Fetch relay configs when active call starts
  useEffect(() => {
    if (!activeCall || !user || !token) {
      setRelayConfigs([]);
      return;
    }

    const apiBase = CONFIG.API_BASE_URL || 'http://localhost:3000';
    const url = `${apiBase}/api/kiosks/${activeCall.buildingId}/relays`;
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) return res.text().then((t) => { throw new Error(`HTTP ${res.status}: ${t}`); });
        return res.json();
      })
      .then((data: RelayConfig[]) => {
        setRelayConfigs(data.filter((r) => !r.accessPointId));
      })
      .catch((err) => {
        console.error('[Relays] Fetch error:', err);
        setRelayConfigs([]);
      });
  }, [activeCall, user, token]);

  // Connect to MQTT bridge Socket.io for relay status
  useEffect(() => {
    if (!activeCall) return;
    const mqttUrl = CONFIG.MQTT_BRIDGE_URL || 'http://localhost:3002';
    const mqttSocket = io(mqttUrl, { transports: ['websocket'] });
    mqttSocketRef.current = mqttSocket;

    mqttSocket.on('relay:status', (data: { buildingId: string; relayIndex: number; state: 'ON' | 'OFF' }) => {
      if (data.buildingId === activeCall.buildingId) {
        setRelayStates((prev) => ({ ...prev, [data.relayIndex]: data.state }));
      }
    });

    return () => {
      mqttSocket.disconnect();
      mqttSocketRef.current = null;
    };
  }, [activeCall]);

  const handleTriggerRelay = useCallback(
    (relayIndex: number) => {
      if (!socket || !activeCall) return;
      socket.emit('relay:trigger', {
        buildingId: activeCall.buildingId,
        relayIndex,
      });
    },
    [socket, activeCall],
  );

  const handleAcceptCall = useCallback(
    (callId: string) => {
      const call = pendingCalls.get(callId);
      if (!call) return;
      stopRing();
      socket?.emit('call:accept', { callId, buildingId: call.buildingId });
      setActiveCall({ ...call });
      removePendingCall(callId);
    },
    [socket, pendingCalls, setActiveCall, removePendingCall, stopRing],
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_280px] md:grid-rows-1 h-full">
      <div className="flex flex-col border-r border-border overflow-y-auto md:overflow-y-visible">
        <CallQueue pendingCalls={pendingCalls} onAccept={handleAcceptCall} />
        <KioskList />
      </div>
      <div className="flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
            Videollamada
          </span>
        </div>
        {!activeCall && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="text-5xl opacity-15">📹</div>
            <div className="text-xs tracking-widest uppercase">Sin llamada activa</div>
            <div className="text-[11px]">Las llamadas entrantes aparecerán como notificación</div>
          </div>
        )}
        {activeCall && (
          <div className="p-4">
            <div className="font-syne text-base font-bold text-foreground mb-3">
              🟢 {activeCall.buildingName}
            </div>
            <p className="font-mono text-xs text-muted-foreground mb-4">
              La videollamada se muestra en la ventana flotante. Usá los controles de la ventana para colgar, silenciar o abrir la puerta.
            </p>
            {relayConfigs.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {relayConfigs.map((r) => (
                  <button
                    key={r.relayIndex}
                    onClick={() => handleTriggerRelay(r.relayIndex)}
                    className={`px-4 py-2 rounded font-mono text-xs font-bold border-none cursor-pointer transition-colors ${
                      relayStates[r.relayIndex] === 'ON'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="overflow-y-auto border-t border-border max-h-[200px] md:col-span-full">
        <EventLog />
        <div className="text-center mt-2">
          <span
            className="font-mono text-[11px] text-muted-foreground underline cursor-pointer"
            title="Disponible en el panel de administración"
          >
            Ver bitácora completa
          </span>
        </div>
        <OperatorCallHistory />
      </div>
    </div>
  );
}
