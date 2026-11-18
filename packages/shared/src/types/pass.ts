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

/**
 * Where an authorization sends its visitor. Every destination is a node of the
 * community location tree; `common_area` only changes how it is classified.
 */
export type DestinationKind = 'home' | 'common_area';

export interface DestinationSummary {
  id: string;
  name: string;
  /** Full path from the level-1 section, separated by `›`. */
  path: string;
  kind: DestinationKind;
}

/**
 * A destination offered to the resident. `active` is false for a place that was
 * archived after it received passes: the history filter still lists it so those
 * rows stay filterable.
 */
export interface DestinationOption extends DestinationSummary {
  active: boolean;
}

/**
 * How often a pass can be used. `once` is one entry/exit inside the validity
 * window; `range` allows every day between the dates; `weekly` only the marked
 * weekdays.
 */
export type PassRecurrence = 'once' | 'range' | 'weekly';

/**
 * Someone who arrives with the primary visitor. Informational only: companions
 * share the pass, its QR and its use counter.
 */
export interface PassCompanion {
  firstName: string;
  lastName: string;
  document: string;
}

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
  /** Snapshot of the group that arrives with the primary visitor. */
  companions: PassCompanion[];
  hasVehicle: boolean;
  vehiclePlate: string | null;
  type: PassType;
  maxUses: number;
  recurrence: PassRecurrence;
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

/**
 * Readable version of the pass rule. `remainingUses` is per day for `range` and
 * `weekly`; for `once` it is the total left in the whole validity window.
 */
export interface PassRuleSummary {
  recurrence: PassRecurrence;
  /** 0 = Sunday. Only set for `weekly`; `null` means every day. */
  allowedDays: number[] | null;
  timeFrom: string | null;
  timeTo: string | null;
  /** Entry/exit pairs per day, or in total for `once`. */
  maxUses: number;
  remainingUses: number;
  /** One-line Spanish description ready to render in the UI. */
  summary: string;
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

/** One CSV line of a bulk authorization. */
export interface PassBatchVisitorInput {
  firstName: string;
  lastName: string;
  document: string;
  /** When present, the visitor is authorized with a vehicle. */
  vehiclePlate?: string | null;
  /** Group that arrives with this visitor; informational only. */
  companions?: PassCompanion[];
}

/**
 * A whole batch shares destination, window and label: the file only carries
 * visitors, so every pass of the batch differs just in who is authorized.
 */
export interface PassBatchRequest {
  /** Entry and exit pairs applied to every pass of the batch. */
  maxUses?: number;
  destination: string;
  type: PassType;
  validFrom: string;
  validUntil: string;
  batchLabel?: string | null;
  visitors: PassBatchVisitorInput[];
}

export interface PassBatchCreated {
  id: string;
  visitorFirstName: string;
  visitorLastName: string;
  visitorDocument: string;
  vehiclePlate: string | null;
}

export interface PassBatchRejection {
  document: string;
  visitorFirstName: string;
  visitorLastName: string;
  reason: string;
}

export interface PassBatchResult {
  batchId: string;
  batchLabel: string | null;
  createdCount: number;
  rejectedCount: number;
  created: PassBatchCreated[];
  rejected: PassBatchRejection[];
}

/** Dry run of a batch: the same classification the insert will apply. */
export interface PassBatchPreview {
  batchLabel: string | null;
  total: number;
  validCount: number;
  rejected: PassBatchRejection[];
}
