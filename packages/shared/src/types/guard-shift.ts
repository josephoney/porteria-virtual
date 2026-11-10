import type { GuardShiftStatus } from '../enums/index.js';

export interface GuardShift {
  id: string;
  communityId: string;
  guardPersonId: string;
  guardAccountId: string | null;
  status: GuardShiftStatus;
  startedAt: Date;
  endedAt: Date | null;
  endedByPersonId: string | null;
  closedReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface GuardShiftSegment {
  id: string;
  shiftId: string;
  accessPointId: string;
  startedAt: Date;
  endedAt: Date | null;
  endReason: string | null;
  createdAt: Date;
}

export interface GuardShiftWithSegments extends GuardShift {
  segments: GuardShiftSegment[];
}
