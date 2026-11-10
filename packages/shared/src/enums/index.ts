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

export const PassType = {
  EntryOnly: 'entry_only',
  EntryExit: 'entry_exit',
  EntryExitRecurring: 'entry_exit_recurring',
} as const;

export type PassType = (typeof PassType)[keyof typeof PassType];

export const PassTypeValues = Object.values(PassType) as PassType[];

export const PassStatus = {
  Active: 'active',
  Used: 'used',
  Revoked: 'revoked',
  Expired: 'expired',
} as const;

export type PassStatus = (typeof PassStatus)[keyof typeof PassStatus];

export const PassStatusValues = Object.values(PassStatus) as PassStatus[];

export const PresenceState = {
  Outside: 'outside',
  Inside: 'inside',
} as const;

export type PresenceState = (typeof PresenceState)[keyof typeof PresenceState];

export const PresenceStateValues = Object.values(PresenceState) as PresenceState[];

export const ScanAction = {
  Entry: 'entry',
  Exit: 'exit',
} as const;

export type ScanAction = (typeof ScanAction)[keyof typeof ScanAction];

export const ScanActionValues = Object.values(ScanAction) as ScanAction[];

export const ScanStatus = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Rejected: 'rejected',
  Expired: 'expired',
} as const;

export type ScanStatus = (typeof ScanStatus)[keyof typeof ScanStatus];

export const ScanStatusValues = Object.values(ScanStatus) as ScanStatus[];

export const ScanResult = {
  Authorized: 'authorized',
  Denied: 'denied',
} as const;

export type ScanResult = (typeof ScanResult)[keyof typeof ScanResult];

export const ScanResultValues = Object.values(ScanResult) as ScanResult[];

export const PassAlertType = {
  MissingExit: 'missing_exit',
} as const;

export type PassAlertType = (typeof PassAlertType)[keyof typeof PassAlertType];

export const PassAlertTypeValues = Object.values(PassAlertType) as PassAlertType[];

export const PassAlertStatus = {
  Open: 'open',
  Resolved: 'resolved',
} as const;

export type PassAlertStatus = (typeof PassAlertStatus)[keyof typeof PassAlertStatus];

export const PassAlertStatusValues = Object.values(PassAlertStatus) as PassAlertStatus[];

export const AccessPointType = {
  Door: 'door',
  Gate: 'gate',
  Turnstile: 'turnstile',
} as const;

export type AccessPointType = (typeof AccessPointType)[keyof typeof AccessPointType];

export const AccessPointTypeValues = Object.values(AccessPointType) as AccessPointType[];

export const AccessPointDirection = {
  Entry: 'entry',
  Exit: 'exit',
  Both: 'both',
} as const;

export type AccessPointDirection =
  (typeof AccessPointDirection)[keyof typeof AccessPointDirection];

export const AccessPointDirectionValues = Object.values(
  AccessPointDirection,
) as AccessPointDirection[];

export const GuardShiftStatus = {
  Open: 'open',
  Closed: 'closed',
} as const;

export type GuardShiftStatus = (typeof GuardShiftStatus)[keyof typeof GuardShiftStatus];

export const GuardShiftStatusValues = Object.values(
  GuardShiftStatus,
) as GuardShiftStatus[];

export const BitacoraEntryType = {
  PassEntry: 'pass_entry',
  PassExit: 'pass_exit',
  PassRejected: 'pass_rejected',
  ScanDenied: 'scan_denied',
  ShiftStart: 'shift_start',
  ShiftEnd: 'shift_end',
  Manual: 'manual',
} as const;

export type BitacoraEntryType =
  (typeof BitacoraEntryType)[keyof typeof BitacoraEntryType];

export const BitacoraEntryTypeValues = Object.values(
  BitacoraEntryType,
) as BitacoraEntryType[];

export const BitacoraSource = {
  App: 'app',
  Dashboard: 'dashboard',
  System: 'system',
} as const;

export type BitacoraSource = (typeof BitacoraSource)[keyof typeof BitacoraSource];

export const BitacoraSourceValues = Object.values(BitacoraSource) as BitacoraSource[];
