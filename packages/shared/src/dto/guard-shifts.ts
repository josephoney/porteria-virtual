import type { AccessPoint } from '../types/access-point.js';
import type { GuardShift, GuardShiftSegment } from '../types/guard-shift.js';

export type GuardShiftSource = 'app' | 'dashboard';

export interface StartShiftDto {
  accessPointId?: string;
  source?: GuardShiftSource;
}

export interface ChangeAccessPointDto {
  accessPointId: string;
  source?: GuardShiftSource;
}

export interface EndShiftDto {
  source?: GuardShiftSource;
}

export interface ForceCloseShiftDto {
  reason: string;
}

export interface GuardShiftSegmentDto extends GuardShiftSegment {
  accessPointName: string;
}

export interface GuardShiftDto extends GuardShift {
  accessPointName: string | null;
  segments?: GuardShiftSegmentDto[];
}

export interface GuardShiftCurrentResponse {
  shift: GuardShiftDto | null;
  segment: GuardShiftSegmentDto | null;
  accessPoint: AccessPoint | null;
  stale: boolean;
  elapsedSeconds: number;
}

export interface GuardShiftHistoryItem extends GuardShiftDto {
  durationSeconds: number;
}

export interface GuardShiftListResponse {
  items: GuardShiftHistoryItem[];
  page: number;
  pageSize: number;
  total: number;
}
