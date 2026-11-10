import type { BitacoraEntryType, BitacoraSource } from '../enums/index.js';

export interface BitacoraEntry {
  id: string;
  communityId: string;
  accessPointId: string;
  accessPointName: string;
  destinationLocationUnitId: string | null;
  destinationPath: string | null;
  authorizedByPersonId: string | null;
  authorizedByName: string | null;
  shiftId: string | null;
  type: BitacoraEntryType;
  source: BitacoraSource;
  authorPersonId: string | null;
  authorAccountId: string | null;
  passId: string | null;
  passScanId: string | null;
  summary: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface BitacoraComment {
  id: string;
  entryId: string;
  authorPersonId: string | null;
  authorAccountId: string | null;
  body: string;
  createdAt: Date;
}
