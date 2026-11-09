import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { asc, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { communities, organizations, people } from '@porteria/database/schema';
import { requireRole } from '../middlewares/rbac.js';
import * as slugService from '../services/slug.service.js';
import { auditCommunityEvent } from '../services/audit.service.js';
import { insertEvent } from '../services/events.service.js';
import { can } from '../services/admin-permissions.service.js';

const db = createDb();

const COMMUNITY_TYPES = [
  'conjunto',
  'condominio',
  'club',
  'hotel',
  'edificio',
  'otro',
] as const;

type CommunityType = (typeof COMMUNITY_TYPES)[number];

function getUser(request: FastifyRequest) {
  const u = request.user;
  return {
    role: u.role,
    orgId: u.orgId,
    sub: u.sub,
    communityId: u.communityId ?? null,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
  };
}

function normalizeNit(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const normalized = String(value).replace(/\D/g, '');
  return normalized || null;
}

function parseCoordinates(
  latitude: unknown,
  longitude: unknown,
): { latitude: string | null; longitude: string | null } | null {
  if (latitude === undefined && longitude === undefined) {
    return { latitude: null, longitude: null };
  }
  if (latitude == null && longitude == null) {
    return { latitude: null, longitude: null };
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }
  return { latitude: String(lat), longitude: String(lng) };
}

function parseCommunityType(value: unknown): CommunityType | null {
  return COMMUNITY_TYPES.includes(value as CommunityType)
    ? (value as CommunityType)
    : null;
}

export async function organizationAdminRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message:
          (err as { code?: string }).code === 'FAST_JWT_EXPIRED'
            ? 'Token expired'
            : 'Invalid token',
      });
    }
  });

  function rejectPlatform(request: FastifyRequest, reply: FastifyReply): boolean {
    if (getUser(request).isPlatformAdmin) {
      reply.status(403).send({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Platform administrators have read-only tenant access',
      });
      return true;
    }
    return false;
  }

  app.get(
    '/me',
    { preHandler: [requireRole('org_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (rejectPlatform(request, reply)) return;
      const user = getUser(request);
      if (!can(user, 'organization.read', { organizationId: user.orgId })) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
      const [organization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, user.orgId))
        .limit(1);
      if (!organization) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Organization not found',
        });
      }
      return organization;
    },
  );

  app.patch(
    '/me',
    { preHandler: [requireRole('org_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (rejectPlatform(request, reply)) return;
      const user = getUser(request);
      if (!can(user, 'organization.update', { organizationId: user.orgId })) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
      const body = request.body as {
        nit?: string | null;
        phone?: string | null;
        address?: string | null;
        legalRepresentativePersonId?: string | null;
        logoAssetId?: string | null;
        welcomeMessage?: string | null;
      };

      if (body.legalRepresentativePersonId) {
        const [person] = await db
          .select({ id: people.id })
          .from(people)
          .where(eq(people.id, body.legalRepresentativePersonId))
          .limit(1);
        if (!person) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Legal representative person not found',
          });
        }
      }

      const [existingOrganization] = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, user.orgId))
        .limit(1);
      const nextNit =
        body.nit !== undefined ? normalizeNit(body.nit) : existingOrganization?.nit;
      const nextPhone =
        body.phone !== undefined ? body.phone?.trim() || null : existingOrganization?.phone;
      const nextAddress =
        body.address !== undefined
          ? body.address?.trim() || null
          : existingOrganization?.address;
      const nextLegalRepresentative =
        body.legalRepresentativePersonId !== undefined
          ? body.legalRepresentativePersonId || null
          : existingOrganization?.legalRepresentativePersonId;
      const profileComplete = Boolean(
        nextNit && nextPhone && nextAddress && nextLegalRepresentative,
      );

      try {
        const [updated] = await db
          .update(organizations)
          .set({
            ...(body.nit !== undefined ? { nit: normalizeNit(body.nit) } : {}),
            ...(body.phone !== undefined ? { phone: body.phone?.trim() || null } : {}),
            ...(body.address !== undefined ? { address: body.address?.trim() || null } : {}),
            ...(body.legalRepresentativePersonId !== undefined
              ? { legalRepresentativePersonId: body.legalRepresentativePersonId || null }
              : {}),
            ...(body.logoAssetId !== undefined
              ? { logoAssetId: body.logoAssetId || null }
              : {}),
            ...(body.welcomeMessage !== undefined
              ? { welcomeMessage: body.welcomeMessage?.trim() || null }
              : {}),
            profileCompletedAt: profileComplete
              ? existingOrganization?.profileCompletedAt ?? new Date()
              : null,
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, user.orgId))
          .returning();

        await insertEvent({
          eventType: 'organization.profile.updated',
          actorId: user.sub,
          actorRole: user.role,
          organizationId: user.orgId,
          metadata: {
            changedFields: Object.keys(body),
            organizationId: user.orgId,
          },
        });

        return updated;
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'NIT already exists',
          });
        }
        throw err;
      }
    },
  );

  app.get(
    '/me/communities',
    { preHandler: [requireRole('org_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (rejectPlatform(request, reply)) return;
      const user = getUser(request);
      if (!can(user, 'community.read', { organizationId: user.orgId })) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }

      return db
        .select({
          id: communities.id,
          name: communities.name,
          slug: communities.slug,
          address: communities.address,
          phone: communities.phone,
          type: communities.type,
          typeLabel: communities.typeLabel,
          latitude: communities.latitude,
          longitude: communities.longitude,
          timezone: communities.timezone,
          status: communities.status,
          organizationId: communities.organizationId,
          logoAssetId: communities.logoAssetId,
          welcomeMessage: communities.welcomeMessage,
        })
        .from(communities)
        .where(eq(communities.organizationId, user.orgId))
        .orderBy(asc(communities.name));
    },
  );

  app.post(
    '/me/communities',
    { preHandler: [requireRole('org_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (rejectPlatform(request, reply)) return;
      const user = getUser(request);
      if (!can(user, 'community.create', { organizationId: user.orgId })) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
      const body = request.body as {
        name?: string;
        address?: string;
        phone?: string | null;
        type?: string;
        typeLabel?: string | null;
        latitude?: number | string | null;
        longitude?: number | string | null;
        timezone?: string;
        slug?: string;
        welcomeMessage?: string | null;
      };
      if (!body.name?.trim() || !body.address?.trim() || !body.timezone?.trim()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'name, address and timezone are required',
        });
      }

      const type = parseCommunityType(body.type ?? 'conjunto');
      if (!type) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid community type',
        });
      }
      if (type === 'otro' && !body.typeLabel?.trim()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'typeLabel is required when type is otro',
        });
      }
      const coordinates = parseCoordinates(body.latitude, body.longitude);
      if (!coordinates) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid latitude or longitude',
        });
      }

      try {
        const slug = await slugService.uniqueCommunitySlug(body.slug, body.name);
        const [created] = await db
          .insert(communities)
          .values({
            name: body.name.trim(),
            slug,
            address: body.address.trim(),
            phone: body.phone?.trim() || null,
            type,
            typeLabel: type === 'otro' ? body.typeLabel?.trim() || null : null,
            latitude: coordinates.latitude,
            longitude: coordinates.longitude,
            timezone: body.timezone.trim(),
            organizationId: user.orgId,
            welcomeMessage: body.welcomeMessage?.trim() || null,
            status: 'active',
          })
          .returning();

        await auditCommunityEvent({
          request,
          communityId: created.id,
          eventType: 'community.created',
          metadata: {
            communityId: created.id,
            organizationId: created.organizationId,
            slug: created.slug,
            type: created.type,
          },
        });

        return reply.status(201).send(created);
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A community with that slug already exists',
          });
        }
        throw err;
      }
    },
  );
}
