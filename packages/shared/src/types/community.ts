import type { CommunityStatus } from '../enums/index.js';

export interface Community {
  id: string;
  name: string;
  address: string;
  municipality: string | null;
  department: string | null;
  country: string | null;
  timezone: string;
  organizationId: string;
  status: CommunityStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunityStructureSummary {
  structureId: string;
  levelCount: number;
  levelNames: {
    level1: string;
    level2: string | null;
    level3: string | null;
  };
  level1Count: number;
  level2Count: number;
  leafCount: number;
  uniform: boolean;
  perLevel1: Array<{
    id: string;
    name: string;
    code: string | null;
    level2Count: number;
    leafCount: number;
  }>;
  perLevel2: Array<{
    level1Id: string;
    level1Name: string;
    level2Id: string;
    level2Name: string;
    leafCount: number;
  }>;
}
