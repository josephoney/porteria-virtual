import { eq, and, count } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { users } from '@porteria/database/schema';
import bcrypt from 'bcryptjs';
import type { UserRole } from '@porteria/shared';

interface Requester {
  sub: string;
  role: string;
  orgId: string;
}

const db = createDb();

export interface UserResult {
  id: string;
  email: string;
  name: string;
  role: string;
  organizationId: string;
  locationId: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toUserResult(user: typeof users.$inferSelect): UserResult {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    organizationId: user.organizationId,
    locationId: user.locationId,
    active: user.active,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function getUserById(id: string, requester: Requester): Promise<UserResult | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.organizationId, requester.orgId)))
    .limit(1);

  if (!user) return null;

  // Non-admin can only see themselves
  if (requester.role !== 'admin' && user.id !== requester.sub) return null;

  return toUserResult(user);
}

export async function listUsers(
  orgId: string,
  page: number,
  pageSize: number,
): Promise<{ data: UserResult[]; total: number; page: number; pageSize: number }> {
  const offset = (page - 1) * pageSize;

  const data = await db
    .select()
    .from(users)
    .where(eq(users.organizationId, orgId))
    .orderBy(users.createdAt)
    .limit(pageSize)
    .offset(offset);

  const [result] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.organizationId, orgId));

  return {
    data: data.map(toUserResult),
    total: result?.count ?? 0,
    page,
    pageSize,
  };
}

export async function createUser(
  data: { email: string; password: string; name: string; role: string; locationId?: string | null },
  orgId: string,
): Promise<UserResult | null> {
  // Check duplicate
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.email, data.email), eq(users.organizationId, orgId)))
    .limit(1);

  if (existing) return null;

  const passwordHash = await bcrypt.hash(data.password, 10);

  const [user] = await db
    .insert(users)
    .values({
      email: data.email,
      passwordHash,
      name: data.name,
      role: data.role as UserRole,
      organizationId: orgId,
      locationId: data.locationId ?? null,
      active: true,
    })
    .returning();

  return toUserResult(user!);
}

export async function updateUser(
  id: string,
  data: { name?: string; role?: string; active?: boolean; locationId?: string | null },
  orgId: string,
): Promise<UserResult | null> {
  const [existing] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.organizationId, orgId)))
    .limit(1);

  if (!existing) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updates.name = data.name;
  if (data.role !== undefined) updates.role = data.role;
  if (data.active !== undefined) updates.active = data.active;
  if (data.locationId !== undefined) updates.locationId = data.locationId;

  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, id))
    .returning();

  return toUserResult(updated!);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<boolean> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return false;

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return false;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));

  return true;
}

export async function getMe(userId: string): Promise<UserResult | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  return toUserResult(user);
}
