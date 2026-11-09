import type { MembershipRole } from '../enums/index.js';
import type { Invitation } from '../types/invitation.js';

export interface CreateInvitationDto {
  email: string;
  role: MembershipRole;
  organizationId?: string;
  communityId?: string | null;
  unitId?: string | null;
  expiresInDays?: number;
}

export interface AcceptInvitationDto {
  name?: string;
  password?: string;
}

export interface InvitationCreatedResponse {
  invitation: Invitation;
  acceptUrl: string;
}
