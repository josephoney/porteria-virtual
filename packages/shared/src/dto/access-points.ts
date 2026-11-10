import type { AccessPointDirection, AccessPointType } from '../enums/index.js';
import type { AccessPoint } from '../types/access-point.js';

export interface CreateAccessPointDto {
  name: string;
  type: AccessPointType;
  direction?: AccessPointDirection;
  gpioPin?: number | null;
  failPolicy?: 'open' | 'closed';
}

export interface UpdateAccessPointDto {
  name?: string;
  type?: AccessPointType;
  direction?: AccessPointDirection;
  gpioPin?: number | null;
  failPolicy?: 'open' | 'closed';
  active?: boolean;
}

export type AccessPointDto = AccessPoint;

export interface AccessPointListResponse {
  items: AccessPoint[];
}
