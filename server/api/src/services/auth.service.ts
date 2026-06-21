import { eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { users, refreshTokens } from '@porteria/database/schema';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import config from '../config.js';

const db = createDb();

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(): string {
  return crypto.randomBytes(64).toString('hex');
}

function signAccessToken(payload: Record<string, unknown>): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId: string;
  };
}

export async function login(email: string, password: string): Promise<AuthResult | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || !user.active) return null;

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return null;

  const payload = { sub: user.id, email: user.email, role: user.role, orgId: user.organizationId };
  const accessToken = signAccessToken(payload);
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashToken(rawRefreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash,
    expiresAt: new Date(Date.now() + config.jwt.refreshExpiresInMs),
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
  };
}

export async function refreshToken(token: string): Promise<AuthResult | null> {
  const tokenHash = hashToken(token);

  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!stored || stored.revoked || new Date(stored.expiresAt) < new Date()) return null;

  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.id, stored.id));

  const [user] = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1);
  if (!user || !user.active) return null;

  const payload = { sub: user.id, email: user.email, role: user.role, orgId: user.organizationId };
  const accessToken = signAccessToken(payload);
  const rawRefreshToken = generateRefreshToken();
  const newTokenHash = hashToken(rawRefreshToken);

  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: newTokenHash,
    expiresAt: new Date(Date.now() + config.jwt.refreshExpiresInMs),
  });

  return {
    accessToken,
    refreshToken: rawRefreshToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, organizationId: user.organizationId },
  };
}

export async function logout(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.tokenHash, tokenHash));
  return true;
}

export async function getUserByRefreshToken(token: string): Promise<{ userId: string; role: string; organizationId: string } | null> {
  const tokenHash = hashToken(token);
  const [stored] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, tokenHash))
    .limit(1);

  if (!stored) return null;

  const [user] = await db.select().from(users).where(eq(users.id, stored.userId)).limit(1);
  if (!user) return null;

  return { userId: user.id, role: user.role, organizationId: user.organizationId };
}
