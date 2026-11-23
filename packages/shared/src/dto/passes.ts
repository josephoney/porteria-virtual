import type {
  PassStatus,
  PassType,
  PresenceState,
  ScanAction,
  ScanResult,
  ScanStatus,
} from '../enums/index.js';
import type { AccessPass, PassCompanion } from '../types/pass.js';

export interface CreatePassDto {
  /** Entry and exit pairs. Ignored for entry-only passes, which always use one. */
  maxUses?: number;
  /** once | range | weekly. */
  recurrence?: 'once' | 'range' | 'weekly';
  locationUnitId: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorDocument: string;
  /** Group that arrives with the primary visitor. Informational only. */
  companions?: PassCompanion[];
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
  /**
   * Instante de vencimiento según el reloj del servidor. Se conserva por
   * compatibilidad: los clientes deben contar con `expiresInSeconds`, porque
   * restar este valor contra el reloj del dispositivo mezcla dos relojes.
   */
  expiresAt: string;
  /** Vida útil del token en segundos, medida desde que el cliente lo recibe. */
  expiresInSeconds: number;
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
  /** Only the number of companions: names and documents stay private. */
  companionCount: number;
  type: PassType;
  recurrence: 'once' | 'range' | 'weekly';
  maxUses: number;
  exitCount: number;
  remainingUses: number;
  status: PassStatus;
  presenceState: PresenceState;
  pinRequired: boolean;
}

export interface PassStatusResponse {
  status: PassStatus;
  presenceState: PresenceState;
  exitCount: number;
  remainingUses: number;
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
  /** Group arriving with the primary visitor; informational only. */
  companions: PassCompanion[];
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
