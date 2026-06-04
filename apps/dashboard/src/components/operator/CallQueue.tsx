interface CallInfo {
  callId: string;
  buildingName: string;
  visitor?: { name: string; known: boolean; similarity: number; photo?: string } | null;
  timestamp: number;
}

interface CallQueueProps {
  pendingCalls: Map<string, CallInfo>;
  onAccept: (callId: string) => void;
}

export function CallQueue({ pendingCalls, onAccept }: CallQueueProps) {
  const calls = Array.from(pendingCalls.values());

  return (
    <div className="sidebar-section">
      <div className="sidebar-header">
        <div className="sidebar-title">Cola de llamadas</div>
        <span className="badge amber">{calls.length}</span>
      </div>
      <div className="sidebar-list">
        {calls.length === 0 ? (
          <div className="sidebar-empty">Sin llamadas pendientes</div>
        ) : (
          calls.map((call) => (
            <div key={call.callId} className="call-card incoming">
              <div className="call-card-top">
                <div className="call-building">{call.buildingName}</div>
                <div className="call-time">
                  hace {Math.round((Date.now() - call.timestamp) / 1000)}s
                </div>
              </div>
              {call.visitor?.known && (
                <div className="visitor-preview">
                  {call.visitor.photo && (
                    <img src={call.visitor.photo} alt="" className="visitor-thumb" />
                  )}
                  <div>
                    <div className="visitor-prev-name">{call.visitor.name}</div>
                    <div className="visitor-prev-sim known">
                      Reconocido {Math.round(call.visitor.similarity * 100)}%
                    </div>
                  </div>
                </div>
              )}
              <span className="call-status waiting">Esperando</span>
              <div className="call-card-actions">
                <button
                  className="btn-answer green"
                  onClick={() => onAccept(call.callId)}
                >
                  Contestar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
