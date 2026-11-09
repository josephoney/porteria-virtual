import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  buildings,
  communities,
  units,
  locationStructures,
  locationUnits,
  memberships,
  people,
  accounts,
  users,
  invitations,
} from '@porteria/database/schema';
import { requireRole } from '../middlewares/rbac.js';
import { auditCommunityEvent } from '../services/audit.service.js';
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

function parseCommunityType(value: unknown): CommunityType | null {
  return COMMUNITY_TYPES.includes(value as CommunityType)
    ? (value as CommunityType)
    : null;
}

function parseCoordinates(
  latitude: unknown,
  longitude: unknown,
): { latitude: string | null; longitude: string | null } | null {
  if (latitude == null && longitude == null) {
    return { latitude: null, longitude: null };
  }
  if (latitude == null || longitude == null) return null;
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

function getUser(request: FastifyRequest) {
  const u = request.user;
  return {
    sub: u.sub,
    role: u.role,
    orgId: u.orgId,
    communityId: u.communityId ?? null,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
  };
}

export async function communityRoutes(app: FastifyInstance) {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'Unauthorized',
        message: (err as { code?: string }).code === 'FAST_JWT_EXPIRED' ? 'Token expired' : 'Invalid token',
      });
    }
  });

  app.get(
    '/',
    {
      preHandler: [
        async (request: FastifyRequest, reply: FastifyReply) => {
          const u = getUser(request);
          if (
            !u.isPlatformAdmin &&
            !['org_admin', 'community_admin', 'operator', 'guard'].includes(u.role)
          ) {
            return reply.status(403).send({ error: 'Forbidden' });
          }
        },
      ],
    },
    async (request: FastifyRequest) => {
      const u = getUser(request);
      const query = request.query as { organizationId?: string };
      const organizationId = u.isPlatformAdmin ? query.organizationId?.trim() : u.orgId;
      if (!organizationId) return [];
      const conditions = [eq(communities.organizationId, organizationId)];
      if (!u.isPlatformAdmin && u.role === 'community_admin') {
        const adminMemberships = await db
          .select({ communityId: memberships.communityId })
          .from(memberships)
          .where(
            and(
              eq(memberships.userId, u.sub),
              eq(memberships.role, 'community_admin'),
              eq(memberships.status, 'active'),
            ),
          );
        const assignedCommunityIds = adminMemberships
          .map((membership) => membership.communityId)
          .filter((id): id is string => Boolean(id));
        if (assignedCommunityIds.length > 0) {
          conditions.push(inArray(communities.id, assignedCommunityIds));
        } else if (u.communityId) {
          conditions.push(eq(communities.id, u.communityId));
        }
      } else if (!u.isPlatformAdmin && (u.role === 'operator' || u.role === 'guard')) {
        if (u.communityId) conditions.push(eq(communities.id, u.communityId));
      }

      const rows = await db
        .select({
          id: communities.id,
          name: communities.name,
          address: communities.address,
          phone: communities.phone,
          type: communities.type,
          typeLabel: communities.typeLabel,
          welcomeMessage: communities.welcomeMessage,
          logoAssetId: communities.logoAssetId,
          status: communities.status,
        })
        .from(communities)
        .where(and(...conditions))
        .orderBy(communities.name);
      const communityIds = rows.map((community) => community.id);
      const administratorRows = communityIds.length
        ? await db
            .select({
              communityId: memberships.communityId,
              adminEmail: users.email,
            })
            .from(memberships)
            .innerJoin(users, eq(memberships.userId, users.id))
            .where(
              and(
                inArray(memberships.communityId, communityIds),
                eq(memberships.role, 'community_admin'),
                eq(memberships.status, 'active'),
              ),
            )
            .orderBy(users.email)
        : [];
      const administrators = new Map<string, string>();
      for (const row of administratorRows) {
        if (row.communityId && !administrators.has(row.communityId)) {
          administrators.set(row.communityId, row.adminEmail);
        }
      }
      return rows.map((community) => ({
        ...community,
        administratorEmail: administrators.get(community.id) ?? null,
      }));
    },
  );

  app.get(
    '/:id/overview',
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator', 'guard')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      const { id } = request.params as { id: string };
      const [community] = await db
        .select()
        .from(communities)
        .where(eq(communities.id, id));
      if (!community || (!u.isPlatformAdmin && community.organizationId !== u.orgId)) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Community not found',
        });
      }
      if (
        !u.isPlatformAdmin &&
        u.role === 'community_admin' &&
        u.communityId !== id
      ) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Community out of scope',
        });
      }

      const [nodes, structures] = await Promise.all([
        db
          .select({
            id: locationUnits.id,
            structureId: locationUnits.structureId,
            parentId: locationUnits.parentId,
            levelPosition: locationUnits.levelPosition,
            name: locationUnits.name,
            code: locationUnits.code,
            status: locationUnits.status,
          })
          .from(locationUnits)
          .where(eq(locationUnits.communityId, id)),
        db
          .select({
            id: locationStructures.id,
            levelCount: locationStructures.levelCount,
          })
          .from(locationStructures)
          .where(eq(locationStructures.communityId, id)),
      ]);

      const levelByStructure = new Map(
        structures.map((structure) => [structure.id, structure.levelCount]),
      );
      const children = new Map<string, typeof nodes>();
      for (const node of nodes) {
        if (!node.parentId) continue;
        const list = children.get(node.parentId) ?? [];
        list.push(node);
        children.set(node.parentId, list);
      }

      const countLeaves = (nodeId: string, levelCount: number): number => {
        const stack = [...(children.get(nodeId) ?? [])];
        let total = 0;
        while (stack.length > 0) {
          const current = stack.pop()!;
          if (current.levelPosition === levelCount) total += 1;
          else stack.push(...(children.get(current.id) ?? []));
        }
        return total;
      };

      const sections = nodes
        .filter((node) => node.levelPosition === 1)
        .map((section) => {
          const levelCount = levelByStructure.get(section.structureId) ?? 3;
          return {
            ...section,
            unitCount: countLeaves(section.id, levelCount),
          };
        });

      const [administratorRow] = await db
        .select({
          id: memberships.id,
          personId: people.id,
          firstName: people.firstName,
          lastName: people.lastName,
          email: people.contactEmail,
          accountEmail: accounts.email,
          userEmail: users.email,
          role: memberships.role,
          status: memberships.status,
        })
        .from(memberships)
        .innerJoin(people, eq(memberships.personId, people.id))
        .leftJoin(accounts, eq(accounts.personId, people.id))
        .leftJoin(users, eq(memberships.userId, users.id))
        .where(
          and(
            eq(memberships.organizationId, community.organizationId),
            eq(memberships.communityId, id),
            eq(memberships.role, 'community_admin'),
            eq(memberships.status, 'active'),
          ),
        )
        .limit(1);
      const administrator = administratorRow
        ? {
            ...administratorRow,
            email:
              administratorRow.email ??
              administratorRow.userEmail ??
              administratorRow.accountEmail,
            name: `${administratorRow.firstName} ${administratorRow.lastName}`.trim(),
          }
        : null;

      const [pendingAdministrator] = await db
        .select({
          id: invitations.id,
          email: invitations.email,
          status: invitations.status,
        })
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, community.organizationId),
            eq(invitations.communityId, id),
            eq(invitations.role, 'community_admin'),
            eq(invitations.status, 'pending'),
          ),
        )
        .limit(1);

      return {
        community,
        administrator: administrator ?? null,
        pendingAdministrator: pendingAdministrator ?? null,
        sections,
        sectionCount: sections.length,
        unitCount: sections.reduce((total, section) => total + section.unitCount, 0),
      };
    },
  );

  app.patch(
    '/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      if (u.isPlatformAdmin) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Platform administrators have read-only tenant access',
        });
      }

      const { id } = request.params as { id: string };
      const [existing] = await db
        .select()
        .from(communities)
        .where(eq(communities.id, id));
      if (
        !existing ||
        !can(u, 'community.update', {
          organizationId: existing.organizationId,
          communityId: id,
        })
      ) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Community not found',
        });
      }
      if (u.role === 'community_admin' && u.communityId !== id) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Community out of scope',
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
        logoAssetId?: string | null;
        welcomeMessage?: string | null;
        status?: 'active' | 'inactive';
      };

      const type = body.type === undefined ? existing.type : parseCommunityType(body.type);
      if (!type) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid community type',
        });
      }
      const typeLabel =
        body.typeLabel !== undefined
          ? body.typeLabel?.trim() || null
          : existing.typeLabel;
      if (type === 'otro' && !typeLabel) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'typeLabel is required when type is otro',
        });
      }

      let coordinates: { latitude: string | null; longitude: string | null } | null =
        null;
      if (body.latitude !== undefined || body.longitude !== undefined) {
        coordinates = parseCoordinates(body.latitude, body.longitude);
        if (!coordinates) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Invalid latitude or longitude',
          });
        }
      }

      const [updated] = await db
        .update(communities)
        .set({
          ...(body.name !== undefined ? { name: body.name.trim() } : {}),
          ...(body.address !== undefined ? { address: body.address.trim() } : {}),
          ...(body.phone !== undefined ? { phone: body.phone?.trim() || null } : {}),
          type,
          typeLabel: type === 'otro' ? typeLabel : null,
          ...(coordinates
            ? { latitude: coordinates.latitude, longitude: coordinates.longitude }
            : {}),
          ...(body.timezone !== undefined ? { timezone: body.timezone.trim() } : {}),
          ...(body.logoAssetId !== undefined
            ? { logoAssetId: body.logoAssetId || null }
            : {}),
          ...(body.welcomeMessage !== undefined
            ? { welcomeMessage: body.welcomeMessage?.trim() || null }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(communities.id, id))
        .returning();

      await auditCommunityEvent({
        request,
        communityId: id,
        eventType: 'community.updated',
        metadata: {
          communityId: id,
          changedFields: Object.keys(body),
          type: updated.type,
        },
      });

      return updated;
    },
  );

  app.get(
    '/:id/buildings',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      const { id } = request.params as { id: string };

      const [community] = await db
        .select({ organizationId: communities.organizationId })
        .from(communities)
        .where(eq(communities.id, id));

      if (!community || community.organizationId !== u.orgId) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Community not found',
        });
      }

      if (
        (u.role === 'community_admin') &&
        u.communityId &&
        u.communityId !== id
      ) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Community out of scope',
        });
      }

      return db
        .select({
          id: buildings.id,
          communityId: buildings.communityId,
          name: buildings.name,
          code: buildings.code,
          floors: buildings.floors,
        })
        .from(buildings)
        .where(eq(buildings.communityId, id))
        .orderBy(buildings.name);
    },
  );

  app.get(
    '/:id/units',
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = getUser(request);
      const { id } = request.params as { id: string };

      const [community] = await db
        .select({ organizationId: communities.organizationId })
        .from(communities)
        .where(eq(communities.id, id));

      if (!community || community.organizationId !== u.orgId) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Community not found',
        });
      }

      if (
        (u.role === 'community_admin' || u.role === 'operator') &&
        u.communityId &&
        u.communityId !== id
      ) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Community out of scope',
        });
      }

      const rows = await db
        .select({
          id: units.id,
          code: units.code,
          buildingId: units.buildingId,
          floor: units.floor,
          type: units.type,
          status: units.status,
        })
        .from(units)
        .where(eq(units.communityId, id))
        .orderBy(units.code);

      return rows;
    },
  );
}
