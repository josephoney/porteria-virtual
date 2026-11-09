import type { CommunityStatus } from '../enums/index.js';

export interface Community {
  id: string;
  name: string;
  address: string;
  timezone: string;
  organizationId: string;
  status: CommunityStatus;
  createdAt: Date;
  updatedAt: Date;
}
