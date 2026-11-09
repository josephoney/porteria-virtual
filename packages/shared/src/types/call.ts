import type { CallStatus } from '../enums/index.js';

export interface Call {
  id: string;
  kioskId: string;
  operatorId: string | null;
  organizationId: string;
  communityId: string;
  accessPointId: string | null;
  status: CallStatus;
  startedAt: Date;
  endedAt: Date | null;
  duration: number | null;
}
