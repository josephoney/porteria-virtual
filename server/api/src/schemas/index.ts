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
