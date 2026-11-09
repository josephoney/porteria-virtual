import type { FastifyRequest, FastifyReply } from 'fastify';

interface RequestUser {
  sub?: string;
  role?: string;
  orgId?: string;
  communityId?: string | null;
  isPlatformAdmin?: boolean;
}

export function canAccessCommunity(user: RequestUser | undefined, communityId?: string | null) {
  if (!user) return false;
  if (user.isPlatformAdmin) return true;
  if (user.role === 'org_admin') return true;
  if (!communityId) return true;
  return user.communityId === communityId;
}

export function requireRole(...roles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as RequestUser | undefined;
    if (user?.isPlatformAdmin) return;
    if (!roles.includes(user?.role ?? '')) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }
  };
}

export function requireCommunityAccess(
  getCommunityId: (request: FastifyRequest) => string | null | undefined,
) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const communityId = getCommunityId(request);
    if (!canAccessCommunity(request.user as RequestUser, communityId)) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Community out of scope',
      });
    }
  };
}

export function requireSelfOrRole(...roles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as RequestUser | undefined;
    const targetId = (request.params as { id?: string })?.id;
    if (user?.sub === targetId) return;
    if (user?.isPlatformAdmin) return;
    if (!roles.includes(user?.role ?? '')) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    }
  };
}
export function requirePlatformAdmin() {
  return async function (request: FastifyRequest, reply: FastifyReply) {
    const user = request.user as RequestUser | undefined;
    if (!user?.isPlatformAdmin) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Platform administrator access required',
      });
    }
  };
}