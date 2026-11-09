import { z } from 'zod';
import { MembershipRoleValues } from '@porteria/shared';

export const membershipRoleSchema = z.enum(
  MembershipRoleValues as [string, ...string[]],
);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  communitySlug: z.string().min(1).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const contextSwitchSchema = z.object({
  membershipId: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255).optional(),
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().max(120).optional(),
  documentType: z.string().max(30).optional(),
  documentNumber: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
  role: membershipRoleSchema,
  communityId: z.string().uuid().nullable().optional(),
  communityIds: z.array(z.string().uuid()).optional(),
  unitId: z.string().uuid().nullable().optional(),
  locationUnitId: z.string().uuid().nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  active: z.boolean().optional(),
});

export const createMembershipSchema = z.object({
  userId: z.string().uuid(),
  role: membershipRoleSchema,
  communityId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  locationUnitId: z.string().uuid().nullable().optional(),
});

export const updateMembershipSchema = z.object({
  role: membershipRoleSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
  communityId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  locationUnitId: z.string().uuid().nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const callsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'active', 'ended', 'missed']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  operatorId: z.string().optional(),
  communityId: z.string().uuid().optional(),
});

export const eventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  eventType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  actorId: z.string().uuid().optional(),
  accessPointId: z.string().uuid().optional(),
  communityId: z.string().uuid().optional(),
});

export const kiosksQuerySchema = z.object({
  status: z.enum(['idle', 'calling', 'in-call', 'offline']).optional(),
  communityId: z.string().uuid().optional(),
});

export const triggerRelaySchema = z.object({
  kioskId: z.string(),
  relayIndex: z.number().int().min(1).max(4).optional(),
  accessPointId: z.string().uuid().optional(),
  requestId: z.string().optional(),
  source: z.enum(['access', 'operator', 'system']).optional(),
});
export const acceptInvitationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  password: z.string().min(8).optional(),
});

export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: membershipRoleSchema,
  organizationId: z.string().uuid().optional(),
  communityId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  locationUnitId: z.string().uuid().nullable().optional(),
  expiresInDays: z.coerce.number().int().min(1).max(30).optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(3).max(60).optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(3).max(60).optional(),
});

export const createCommunitySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(500),
  timezone: z.string().min(1).max(50),
  slug: z.string().min(3).max(60).optional(),
});

export const updateCommunitySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().min(1).max(500).optional(),
  timezone: z.string().min(1).max(50).optional(),
  slug: z.string().min(3).max(60).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const createPlatformBuildingSchema = z.object({
  communityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().max(50).nullable().optional(),
  floors: z.coerce.number().int().min(0).nullable().optional(),
});

export const createPlatformUnitSchema = z.object({
  communityId: z.string().uuid(),
  buildingId: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(50),
  floor: z.coerce.number().int().nullable().optional(),
  type: z.enum(['apartment', 'house', 'office', 'parking', 'storage']),
});

export const inviteOrgAdminSchema = z.object({
  email: z.string().email(),
});