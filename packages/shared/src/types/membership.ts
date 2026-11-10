import type { MembershipRole, MembershipStatus } from '../enums/index.js';

export interface Membership {
  id: string;
  userId: string;
  personId: string | null;
  organizationId: string;
  communityId: string | null;
  unitId: string | null;
  locationUnitId: string | null;
  defaultAccessPointId: string | null;
  role: MembershipRole;
  status: MembershipStatus;
  validFrom: Date | null;
  validTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
