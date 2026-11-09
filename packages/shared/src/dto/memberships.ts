import type { MembershipRole, MembershipStatus } from '../enums/index.js';

export interface CreateMembershipDto {
  userId: string;
  role: MembershipRole;
  communityId?: string | null;
  unitId?: string | null;
}

export interface UpdateMembershipDto {
  role?: MembershipRole;
  status?: MembershipStatus;
  communityId?: string | null;
  unitId?: string | null;
}
