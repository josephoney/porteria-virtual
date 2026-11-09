import type { InvitationStatus, MembershipRole } from '../enums/index.js';

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  communityId: string | null;
  unitId: string | null;
  role: MembershipRole;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  invitedBy: string | null;
  createdAt: Date;
}

export interface PublicInvitationPreview {
  communityName: string;
  unitCode: string | null;
  role: MembershipRole;
  maskedEmail: string;
  expiresAt: Date;
}
