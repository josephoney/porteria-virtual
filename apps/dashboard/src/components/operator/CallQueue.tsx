import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

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
    <div className="border-b border-border">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <span className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
          Cola de llamadas
        </span>
        <Badge variant="warning" className="font-mono text-[10px]">
          {calls.length}
        </Badge>
      </div>
      <div className="p-3 flex flex-col gap-2">
        {calls.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-4">
            Sin llamadas pendientes
          </div>
        ) : (
          calls.map((call) => (
            <Card key={call.callId} className="bg-background relative overflow-hidden">
              {/* Incoming indicator bar */}
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-warning animate-pulse" />
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-foreground">{call.buildingName}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    hace {Math.round((Date.now() - call.timestamp) / 1000)}s
                  </span>
                </div>
                {call.visitor?.known && (
                  <div className="flex items-center gap-2 p-1.5 rounded bg-background">
                    {call.visitor.photo && (
                      <img
                        src={call.visitor.photo}
                        alt=""
                        className="w-8 h-8 rounded-full object-cover border border-border"
                      />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-foreground">{call.visitor.name}</div>
                      <div className="text-[10px] tracking-wide text-primary">
                        Reconocido {Math.round(call.visitor.similarity * 100)}%
                      </div>
                    </div>
                  </div>
                )}
                <Badge variant="warning" className="text-[10px] tracking-widest uppercase">
                  Esperando
                </Badge>
                <Button
                  className="w-full h-8 text-xs font-bold tracking-wider uppercase"
                  onClick={() => onAccept(call.callId)}
                >
                  Contestar
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
