import type {
  PassStatus,
  PassType,
  PresenceState,
  ScanAction,
  ScanResult,
  ScanStatus,
} from '../enums/index.js';
import type { AccessPass } from '../types/pass.js';

export interface CreatePassDto {
  locationUnitId: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorDocument: string;
  hasVehicle?: boolean;
  vehiclePlate?: string | null;
  type: PassType;
  validFrom: string;
  validUntil: string;
  allowedDays?: number[] | null;
  timeFrom?: string | null;
  timeTo?: string | null;
  pin?: string | null;
}

export interface PassLinkResponse {
  pass: AccessPass;
  shareUrl: string;
  qrToken: string;
  qrExpiresAt: string;
}

export interface PassQrResponse {
  token: string;
  expiresAt: string;
}

export interface BindPassDto {
  pin?: string;
}

export interface PublicPassPreview {
  communityName: string;
  visitorFirstName: string;
  maskedDocument: string;
  locationPath: string;
  validFrom: string;
  validUntil: string;
  timeFrom: string | null;
  timeTo: string | null;
  vehiclePlate: string | null;
  status: PassStatus;
  presenceState: PresenceState;
  pinRequired: boolean;
}

export interface PassStatusResponse {
  status: PassStatus;
  presenceState: PresenceState;
  nextWindow: { from: string; to: string } | null;
}

export interface ScanPassResponse {
  scanId: string | null;
  authorized: boolean;
  action: ScanAction | null;
  result: ScanResult;
  reason: string | null;
  visitor: {
    firstName: string;
    lastName: string;
    document: string;
  };
  vehiclePlate: string | null;
  locationPath: string;
  accessPointId: string;
  accessPointName: string;
  shiftId: string;
  bitacoraEntryId: string | null;
  authorizedByName: string;
  schedule: {
    validFrom: string;
    validUntil: string;
    timeFrom: string | null;
    timeTo: string | null;
  };
  presenceState: PresenceState;
  status: ScanStatus | null;
}

export interface ScanDecisionResponse {
  scanId: string;
  status: ScanStatus;
  action: ScanAction;
  passStatus: PassStatus;
  presenceState: PresenceState;
  bitacoraEntryId: string | null;
}
