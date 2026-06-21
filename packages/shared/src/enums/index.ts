export const UserRole = {
  Admin: 'admin',
  Operator: 'operator',
  Guard: 'guard',
  Resident: 'resident',
} as const;

export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserRoleValues = Object.values(UserRole) as UserRole[];

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
