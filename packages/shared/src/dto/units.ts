import type { UnitType } from '../enums/index.js';

export interface CreateUnitDto {
  communityId: string;
  buildingId?: string | null;
  code: string;
  floor?: number | null;
  type: UnitType;
}

export interface CreateBuildingDto {
  communityId: string;
  name: string;
  code?: string | null;
  floors?: number | null;
}
