import type { MembershipRole } from '../enums/index.js';

export interface AuthContext {
  userId: string;
  accountId?: string;
  personId?: string;
  email: string;
  orgId: string;
  membershipId: string;
  role: MembershipRole;
  communityId: string | null;
  unitId: string | null;
  isPlatformAdmin: boolean;
}
