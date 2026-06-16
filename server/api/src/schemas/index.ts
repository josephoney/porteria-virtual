import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255),
  role: z.enum(['admin', 'operator', 'guard', 'resident']),
  locationId: z.string().uuid().nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.enum(['admin', 'operator', 'guard', 'resident']).optional(),
  active: z.boolean().optional(),
  locationId: z.string().uuid().nullable().optional(),
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
});

export const eventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  eventType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const kiosksQuerySchema = z.object({
  status: z.enum(['idle', 'calling', 'in-call', 'offline']).optional(),
});

export const triggerRelaySchema = z.object({
  kioskId: z.string(),
  relayIndex: z.number().int().min(1).max(4).optional(),
  accessPointId: z.string().uuid().optional(),
});
