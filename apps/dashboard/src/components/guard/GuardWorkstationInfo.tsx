import { useCallback, useEffect, useState } from 'react';
import { get } from '../../lib/apiClient';
import { Badge } from '../ui/badge';

interface WorkstationResponse {
  accessPointId: string | null;
  name: string | null;
  type: string | null;
  direction: string | null;
  active: boolean | null;
}

const TYPE_LABELS: Record<string, string> = {
  door: 'Puerta',
  gate: 'Portón',
  turnstile: 'Torniquete',
};

const DIRECTION_LABELS: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Salida',
  both: 'Ambos',
};

/**
 * Puesto por defecto del guardia.
 *
 * Se lee del endpoint dedicado y no de la sesión: si un administrador reasigna
 * el puesto, el token sigue con el valor viejo hasta el refresh.
 */
export function GuardWorkstationInfo() {
  const [workstation, setWorkstation] = useState<WorkstationResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await get<WorkstationResponse>('/api/me/workstation');
      setWorkstation(data);
      setFailed(false);
    } catch {
      // El panel sigue siendo usable con lo que trae la sesión.
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  if (failed) {
    return <p className="text-muted-foreground">Puesto por defecto: no se pudo consultar</p>;
  }

  if (!workstation) {
    return <p className="text-muted-foreground">Puesto por defecto: consultando…</p>;
  }

  if (!workstation.accessPointId) {
    return (
      <div className="space-y-1">
        <p className="text-muted-foreground">Sin puesto asignado</p>
        <p className="text-xs text-muted-foreground">
          Pide a un administrador que te asigne un puesto por defecto. Mientras tanto puedes
          iniciar turno eligiendo cualquier acceso activo.
        </p>
      </div>
    );
  }

  const details = [
    TYPE_LABELS[workstation.type ?? ''] ?? workstation.type,
    DIRECTION_LABELS[workstation.direction ?? ''] ?? workstation.direction,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Puesto por defecto:</span>
        <span className="font-medium">{workstation.name}</span>
        {workstation.active === false && <Badge variant="warning">Inactivo</Badge>}
      </div>
      {details && <p className="text-xs text-muted-foreground">{details}</p>}
      {workstation.active === false && (
        <p className="text-xs text-muted-foreground">
          Tu puesto está inactivo: al iniciar turno elige otro acceso activo.
        </p>
      )}
    </div>
  );
}
