import type { UnitStatus, UnitType } from '../enums/index.js';

export interface Unit {
  id: string;
  communityId: string;
  buildingId: string | null;
  code: string;
  floor: number | null;
  type: UnitType;
  status: UnitStatus;
  createdAt: Date;
  updatedAt: Date;
}
