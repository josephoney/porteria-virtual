import type { CallStatus } from '../enums/index.js';

export interface Call {
  id: string;
  kioskId: string;
  operatorId: string | null;
  organizationId: string;
  locationId: string;
  accessPointId: string;
  status: CallStatus;
  startedAt: Date;
  endedAt: Date | null;
  duration: number | null;
}
