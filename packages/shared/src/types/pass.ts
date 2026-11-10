import type {
  PassAlertStatus,
  PassAlertType,
  PassStatus,
  PassType,
  PresenceState,
  ScanAction,
  ScanResult,
  ScanStatus,
} from '../enums/index.js';

export interface AccessPass {
  id: string;
  communityId: string;
  locationUnitId: string;
  structureId: string;
  createdByPersonId: string;
  authorizedByPersonId: string;
  authorizedByDelegationId: string | null;
  visitorFirstName: string;
  visitorLastName: string;
  visitorDocument: string;
  hasVehicle: boolean;
  vehiclePlate: string | null;
  type: PassType;
  validFrom: Date;
  validUntil: Date;
  allowedDays: number[] | null;
  timeFrom: string | null;
  timeTo: string | null;
  status: PassStatus;
  presenceState: PresenceState;
  linkExpiresAt: Date;
  pinEnabled: boolean;
  boundAt: Date | null;
  entryAt: Date | null;
  exitAt: Date | null;
  entryCount: number;
  exitCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PassScan {
  id: string;
  passId: string;
  guardPersonId: string;
  guardAccountId: string | null;
  communityId: string;
  locationUnitId: string;
  structureId: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorDocument: string;
  vehiclePlate: string | null;
  action: ScanAction;
  result: ScanResult;
  reason: string | null;
  status: ScanStatus;
  scannedAt: Date;
  confirmedAt: Date | null;
}

export interface PassAlert {
  id: string;
  passId: string;
  communityId: string;
  type: PassAlertType;
  status: PassAlertStatus;
  dueAt: Date;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedByPersonId: string | null;
}
