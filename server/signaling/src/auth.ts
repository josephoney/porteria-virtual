import type { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { and, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { communities, kiosks, memberships } from '@porteria/database/schema';
import { config } from './config.js';

const db = createDb();

interface JwtContextPayload {
  sub: string;
  email: string;
  orgId: string;
  membershipId: string;
  role: string;
  communityId: string | null;
  unitId: string | null;
  isPlatformAdmin: boolean;
}

const OPERATIONAL_ROLES = ['operator', 'guard', 'community_admin', 'org_admin'];

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function authenticateSocket(
  socket: Socket,
  next: (err?: Error) => void,
): Promise<void> {
  const auth = (socket.handshake.auth ?? {}) as {
    token?: string;
    deviceToken?: string;
  };

  if (auth.token) {
    try {
      const payload = jwt.verify(auth.token, config.JWT_SECRET) as JwtContextPayload;

      if (payload.membershipId === 'platform') {
        return next(new Error('Platform context cannot connect as operator'));
      }

      if (!OPERATIONAL_ROLES.includes(payload.role)) {
        return next(new Error('Forbidden role'));
      }

      const [membership] = await db
        .select()
        .from(memberships)
        .where(
          and(
            eq(memberships.id, payload.membershipId),
            eq(memberships.userId, payload.sub),
            eq(memberships.status, 'active'),
          ),
        )
        .limit(1);

      if (!membership) {
        return next(new Error('Invalid membership'));
      }

      socket.data.authType = 'operator';
      socket.data.role = 'operator';
      socket.data.operatorId = payload.sub;
      socket.data.email = payload.email;
      socket.data.orgId = membership.organizationId;
      socket.data.communityId = membership.communityId;
      socket.data.membershipId = membership.id;
      socket.data.membershipRole = membership.role;
      return next();
    } catch {
      return next(new Error('Invalid token'));
    }
  }

  if (auth.deviceToken) {
    const tokenHash = sha256(auth.deviceToken);
    const [row] = await db
      .select({
        kiosk: kiosks,
        organizationId: communities.organizationId,
      })
      .from(kiosks)
      .innerJoin(communities, eq(kiosks.communityId, communities.id))
      .where(eq(kiosks.deviceTokenHash, tokenHash))
      .limit(1);

    if (!row) {
      return next(new Error('Invalid device token'));
    }

    socket.data.authType = 'kiosk';
    socket.data.role = 'kiosk';
    socket.data.kioskId = row.kiosk.id;
    socket.data.rpiId = row.kiosk.rpiId ?? row.kiosk.id;
    socket.data.kioskName = row.kiosk.name;
    socket.data.communityId = row.kiosk.communityId;
    socket.data.organizationId = row.organizationId;
    return next();
  }

  return next(new Error('Authentication required'));
}
