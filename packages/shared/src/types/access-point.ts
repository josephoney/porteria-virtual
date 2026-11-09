export interface AccessPoint {
  id: string;
  name: string;
  type: 'door' | 'gate' | 'turnstile';
  gpioPin: number;
  communityId: string;
  kioskId: string | null;
  failPolicy: 'open' | 'closed';
  direction: 'entry' | 'exit' | 'both';
  createdAt: Date;
  updatedAt: Date;
}
