export interface AccessPoint {
  id: string;
  name: string;
  type: 'door' | 'gate' | 'turnstile';
  gpioPin: number | null;
  communityId: string;
  kioskId: string | null;
  failPolicy: 'open' | 'closed';
  direction: 'entry' | 'exit' | 'both';
  active: boolean;
  /** Cantidad de guardias con este acceso como puesto por defecto. */
  assignedGuards?: number;
  createdAt: Date;
  updatedAt: Date;
}
