export interface AccessPoint {
  id: string;
  name: string;
  type: 'door' | 'gate' | 'turnstile';
  gpioPin: number;
  locationId: string;
  kioskId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
