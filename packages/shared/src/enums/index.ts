export const MembershipRole = {
  OrgAdmin: 'org_admin',
  CommunityAdmin: 'community_admin',
  Operator: 'operator',
  Guard: 'guard',
  Owner: 'owner',
  Tenant: 'tenant',
  Resident: 'resident',
  Staff: 'staff',
} as const;

export type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];

export const MembershipRoleValues = Object.values(MembershipRole) as MembershipRole[];

export const MembershipStatus = {
  Active: 'active',
  Inactive: 'inactive',
} as const;

export type MembershipStatus = (typeof MembershipStatus)[keyof typeof MembershipStatus];

export const MembershipStatusValues = Object.values(MembershipStatus) as MembershipStatus[];

export const CommunityStatus = {
  Active: 'active',
  Inactive: 'inactive',
} as const;

export type CommunityStatus = (typeof CommunityStatus)[keyof typeof CommunityStatus];

export const CommunityStatusValues = Object.values(CommunityStatus) as CommunityStatus[];

export const UnitType = {
  Apartment: 'apartment',
  House: 'house',
  Office: 'office',
  Parking: 'parking',
  Storage: 'storage',
} as const;

export type UnitType = (typeof UnitType)[keyof typeof UnitType];

export const UnitTypeValues = Object.values(UnitType) as UnitType[];

export const UnitStatus = {
  Active: 'active',
  Inactive: 'inactive',
} as const;

export type UnitStatus = (typeof UnitStatus)[keyof typeof UnitStatus];

export const UnitStatusValues = Object.values(UnitStatus) as UnitStatus[];

export const EventType = {
  CallStarted: 'call.started',
  CallEnded: 'call.ended',
  CallMissed: 'call.missed',
  DoorOpen: 'door.open',
  DoorOpened: 'door.opened',
  DoorClosed: 'door.closed',
  KioskOnline: 'kiosk.online',
  KioskOffline: 'kiosk.offline',
  UserCreated: 'user.created',
  UserUpdated: 'user.updated',
  GuardCheckin: 'guard.checkin',
  GuardCheckout: 'guard.checkout',
  GuardRondaStarted: 'guard.ronda_started',
  GuardRondaCheckpoint: 'guard.ronda_checkpoint',
  GuardRondaCompleted: 'guard.ronda_completed',
  GuardRondaMissed: 'guard.ronda_missed',
  VisitorRegistered: 'visitor.registered',
  VisitorAccessGranted: 'visitor.access_granted',
  VisitorAccessDenied: 'visitor.access_denied',
  UserLogin: 'user.login',
  UserLogout: 'user.logout',
  MembershipCreated: 'membership.created',
  MembershipUpdated: 'membership.updated',
  AccessGranted: 'access.granted',
  AccessDenied: 'access.denied',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

export const EventTypeValues = Object.values(EventType) as EventType[];

export const AccessMethod = {
  Remote: 'remote',
  QrCode: 'qr_code',
  Manual: 'manual',
  FaceRecognition: 'face_recognition',
} as const;

export type AccessMethod = (typeof AccessMethod)[keyof typeof AccessMethod];

export const AccessMethodValues = Object.values(AccessMethod) as AccessMethod[];

export const CallStatus = {
  Pending: 'pending',
  Active: 'active',
  Ended: 'ended',
  Missed: 'missed',
} as const;

export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

export const CallStatusValues = Object.values(CallStatus) as CallStatus[];
export const InvitationStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Revoked: 'revoked',
  Expired: 'expired',
} as const;

export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

export const InvitationStatusValues = Object.values(InvitationStatus) as InvitationStatus[];
export const OutboxStatus = {
  Pending: 'pending',
  Processing: 'processing',
  Done: 'done',
  Dead: 'dead',
} as const;

export type OutboxStatus = (typeof OutboxStatus)[keyof typeof OutboxStatus];

export const OutboxStatusValues = Object.values(OutboxStatus) as OutboxStatus[];