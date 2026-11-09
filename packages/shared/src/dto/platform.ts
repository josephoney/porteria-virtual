import type { UnitType } from '../enums/index.js';

export interface CreateOrganizationDto {
  name: string;
  slug?: string;
}

export interface UpdateOrganizationDto {
  name?: string;
  slug?: string;
}

export interface CreateCommunityDto {
  organizationId: string;
  name: string;
  address: string;
  timezone: string;
  slug?: string;
}

export interface UpdateCommunityDto {
  name?: string;
  address?: string;
  timezone?: string;
  slug?: string;
  status?: 'active' | 'inactive';
}

export interface CreatePlatformBuildingDto {
  communityId: string;
  name: string;
  code?: string | null;
  floors?: number | null;
}

export interface CreatePlatformUnitDto {
  communityId: string;
  buildingId?: string | null;
  code: string;
  floor?: number | null;
  type: UnitType;
}
