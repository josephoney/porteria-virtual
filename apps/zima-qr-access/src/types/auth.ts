export interface ZimaAuthUser {
  id: string;
  accountId: string;
  personId: string;
  email: string;
  name: string;
  isPlatformAdmin: boolean;
}

export interface ZimaMembership {
  id: string;
  role: string;
  organizationId: string;
  communityId: string | null;
  unitId: string | null;
  locationUnitId: string | null;
}

export interface ZimaAuthSession {
  accessToken: string;
  refreshToken: string;
  user: ZimaAuthUser;
  activeMembership: ZimaMembership | null;
  memberships: ZimaMembership[];
}
