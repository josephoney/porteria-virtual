import type { MembershipRole } from '../enums/index.js';

export interface LoginRequest {
  email: string;
  password: string;
  communitySlug?: string;
}

export interface AuthUserSummary {
  id: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
}

export interface MembershipSummary {
  id: string;
  role: MembershipRole;
  organizationId: string;
  communityId: string | null;
  unitId: string | null;
  locationUnitId: string | null;
  defaultAccessPointId: string | null;
}

export interface LoginSuccessResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserSummary;
  activeMembership: MembershipSummary;
}

export interface LoginContextSelectionResponse {
  requiresContextSelection: true;
  memberships: MembershipSummary[];
  selectionToken: string;
}

export type LoginResponse = LoginSuccessResponse | LoginContextSelectionResponse;

export interface ContextSwitchRequest {
  membershipId: string;
  refreshToken?: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUserSummary;
  activeMembership: MembershipSummary;
}
