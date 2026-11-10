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
  createdAt: Date;
  updatedAt: Date;
}
