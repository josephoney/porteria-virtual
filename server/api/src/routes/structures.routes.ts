import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, count, eq, gt } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { communities, locationStructures, locationUnits } from '@porteria/database/schema';
import { requireRole } from '../middlewares/rbac.js';
import { auditCommunityEvent } from '../services/audit.service.js';
import { can } from '../services/admin-permissions.service.js';

const db = createDb();

function getUser(request: FastifyRequest) {
  const u = request.user;
  return {
    role: u.role,
    orgId: u.orgId,
    communityId: u.communityId ?? null,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
  };
}

async function communityInScope(
  communityId: string,
  user: ReturnType<typeof getUser>,
): Promise<boolean> {
  if (user.isPlatformAdmin) return true;

  const [community] = await db
    .select({ organizationId: communities.organizationId })
    .from(communities)
    .where(eq(communities.id, communityId));

  if (!community || community.organizationId !== user.orgId) return false;
  if (user.role === 'community_admin' && user.communityId !== communityId) return false;
  return true;
}

const sectionTypes = [
  'tower',
  'interior',
  'building',
  'zone',
  'block',
  'sector',
  'floor',
  'house',
  'lot',
  'commercial',
  'other',
] as const;

type SectionType = (typeof sectionTypes)[number];

function validateSectionType(type?: string | null, label?: string | null): string | null {
  if (type !== undefined && type !== null && !sectionTypes.includes(type as SectionType)) {
    return 'Invalid sectionType';
  }
  if (type === 'other' && !label?.trim()) return 'sectionTypeLabel is required for other';
  return null;
}

function validateLevels(body: {
  levelCount?: number;
  level1Name?: string;
  level2Name?: string;
  level3Name?: string;
}): string | null {
  if (!body.levelCount || body.levelCount < 1 || body.levelCount > 3) {
    return 'levelCount must be between 1 and 3';
  }
  if (!body.level1Name?.trim()) return 'level1Name is required';
  if (body.levelCount >= 2 && !body.level2Name?.trim()) return 'level2Name is required';
  if (body.levelCount >= 3 && !body.level3Name?.trim()) return 'level3Name is required';
  return null;
}

export async function structureRoutes(app: FastifyInstance) {
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
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest) => {
      const user = getUser(request);
      const query = request.query as { communityId?: string };
      const pathCommunityId = (request.params as { communityId?: string }).communityId;
      const communityId = query.communityId ?? pathCommunityId;
      const conditions = user.isPlatformAdmin
        ? []
        : [eq(communities.organizationId, user.orgId)];

      if (user.role === 'community_admin' && user.communityId) {
        conditions.push(eq(locationStructures.communityId, user.communityId));
      } else if (communityId) {
        conditions.push(eq(locationStructures.communityId, communityId));
      }

      return db
        .select({
          id: locationStructures.id,
          communityId: locationStructures.communityId,
          communityName: communities.name,
          name: locationStructures.name,
          levelCount: locationStructures.levelCount,
          level1Name: locationStructures.level1Name,
          level2Name: locationStructures.level2Name,
          level3Name: locationStructures.level3Name,
          status: locationStructures.status,
        })
        .from(locationStructures)
        .innerJoin(communities, eq(locationStructures.communityId, communities.id))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(asc(communities.name), asc(locationStructures.name));
    },
  );

  app.post(
    '/',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const body = request.body as {
        communityId?: string;
        name?: string;
        levelCount?: number;
        level1Name?: string;
        level2Name?: string;
        level3Name?: string;
      };
      const pathCommunityId = (request.params as { communityId?: string }).communityId;
      const communityId = body.communityId ?? pathCommunityId;
      if (
        !can(user, 'location.write', {
          organizationId: user.orgId,
          communityId,
        })
      ) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
      if (!communityId || !body.name?.trim()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'communityId and name are required',
        });
      }
      const levelError = validateLevels(body);
      if (levelError) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: levelError,
        });
      }
      if (!(await communityInScope(communityId, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Community not found',
        });
      }

      const structureName = body.name.trim();

      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(locationStructures)
          .values({
            communityId,
            name: structureName,
            levelCount: body.levelCount!,
            level1Name: body.level1Name!.trim(),
            level2Name: body.levelCount! >= 2 ? body.level2Name!.trim() : null,
            level3Name: body.levelCount! >= 3 ? body.level3Name!.trim() : null,
            status: 'active',
          })
          .returning();

        await auditCommunityEvent({
          request,
          communityId: row.communityId,
          eventType: 'location_structure.created',
          metadata: {
            structureId: row.id,
            name: row.name,
            levelCount: row.levelCount,
          },
          executor: tx,
        });

        return row;
      });

      return reply.status(201).send(created);
    },
  );

  app.patch(
    '/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        levelCount?: number;
        level1Name?: string;
        level2Name?: string;
        level3Name?: string;
        status?: 'active' | 'inactive';
      };

      const [existing] = await db
        .select()
        .from(locationStructures)
        .where(eq(locationStructures.id, id));
      if (
        !existing ||
        !(await communityInScope(existing.communityId, user)) ||
        !can(user, 'location.write', {
          organizationId: user.orgId,
          communityId: existing.communityId,
        })
      ) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Structure not found',
        });
      }

      const levelError = validateLevels({
        levelCount: body.levelCount ?? existing.levelCount,
        level1Name: body.level1Name ?? existing.level1Name,
        level2Name: body.level2Name ?? existing.level2Name ?? undefined,
        level3Name: body.level3Name ?? existing.level3Name ?? undefined,
      });
      if (levelError) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: levelError,
        });
      }

      if (body.levelCount !== undefined && body.levelCount < existing.levelCount) {
        const [tooDeep] = await db
          .select({ value: count() })
          .from(locationUnits)
          .where(
            and(
              eq(locationUnits.structureId, id),
              gt(locationUnits.levelPosition, body.levelCount),
            ),
          );
        if ((tooDeep?.value ?? 0) > 0) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Cannot reduce levels while nodes exist at deeper levels',
          });
        }
      }

      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(locationStructures)
          .set({
            ...(body.name !== undefined ? { name: body.name.trim() } : {}),
            ...(body.levelCount !== undefined ? { levelCount: body.levelCount } : {}),
            ...(body.level1Name !== undefined ? { level1Name: body.level1Name.trim() } : {}),
            ...(body.level2Name !== undefined ? { level2Name: body.level2Name?.trim() || null } : {}),
            ...(body.level3Name !== undefined ? { level3Name: body.level3Name?.trim() || null } : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
            updatedAt: new Date(),
          })
          .where(eq(locationStructures.id, id))
          .returning();

        await auditCommunityEvent({
          request,
          communityId: updated.communityId,
          eventType: 'location_structure.updated',
          metadata: {
            structureId: updated.id,
            changedFields: Object.keys(body),
            levelCount: updated.levelCount,
            status: updated.status,
          },
          executor: tx,
        });

        return updated;
      });
    },
  );

  app.get(
    '/:id/units',
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator', 'guard')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const [structure] = await db
        .select({
          id: locationStructures.id,
          communityId: locationStructures.communityId,
          levelCount: locationStructures.levelCount,
        })
        .from(locationStructures)
        .where(eq(locationStructures.id, id));
      if (!structure || !(await communityInScope(structure.communityId, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Structure not found',
        });
      }

      const data = await db
        .select({
          id: locationUnits.id,
          structureId: locationUnits.structureId,
          parentId: locationUnits.parentId,
          levelPosition: locationUnits.levelPosition,
          name: locationUnits.name,
          code: locationUnits.code,
          sectionType: locationUnits.sectionType,
          sectionTypeLabel: locationUnits.sectionTypeLabel,
          metadata: locationUnits.metadata,
          status: locationUnits.status,
        })
        .from(locationUnits)
        .where(eq(locationUnits.structureId, id))
        .orderBy(asc(locationUnits.levelPosition), asc(locationUnits.name));

      return {
        data,
        total: data.length,
        structure: {
          id: structure.id,
          communityId: structure.communityId,
          levelCount: structure.levelCount,
        },
      };
    },
  );

  app.post(
    '/:id/units',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = request.body as {
        parentId?: string | null;
        name?: string;
        code?: string | null;
        sectionType?: string | null;
        sectionTypeLabel?: string | null;
        metadata?: Record<string, unknown>;
      };
      const [structure] = await db
        .select()
        .from(locationStructures)
        .where(eq(locationStructures.id, id));
      if (
        !structure ||
        !(await communityInScope(structure.communityId, user)) ||
        !can(user, 'location.write', {
          organizationId: user.orgId,
          communityId: structure.communityId,
        })
      ) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Structure not found',
        });
      }
      if (!body.name?.trim()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'name is required',
        });
      }
      const typeError = validateSectionType(body.sectionType, body.sectionTypeLabel);
      if (typeError) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: typeError,
        });
      }

      let levelPosition = 1;
      if (body.parentId) {
        const [parent] = await db
          .select({
            id: locationUnits.id,
            structureId: locationUnits.structureId,
            levelPosition: locationUnits.levelPosition,
          })
          .from(locationUnits)
          .where(eq(locationUnits.id, body.parentId));
        if (!parent || parent.structureId !== structure.id) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Parent unit not found',
          });
        }
        levelPosition = parent.levelPosition + 1;
      }
      if (levelPosition > structure.levelCount) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Level is deeper than the structure allows',
        });
      }
      if (levelPosition > 1 && (body.sectionType || body.sectionTypeLabel)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'sectionType is only valid for root nodes',
        });
      }

      try {
        const created = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(locationUnits)
            .values({
              communityId: structure.communityId,
              structureId: structure.id,
              parentId: body.parentId || null,
              levelPosition,
              name: body.name!.trim(),
              code: body.code?.trim() || null,
              sectionType: levelPosition === 1 ? ((body.sectionType as SectionType) || null) : null,
              sectionTypeLabel:
                levelPosition === 1 ? body.sectionTypeLabel?.trim() || null : null,
              metadata: body.metadata ?? {},
              status: 'active',
            })
            .returning();

          await auditCommunityEvent({
            request,
            communityId: structure.communityId,
            eventType: 'location_unit.created',
            metadata: {
              structureId: structure.id,
              unitId: row.id,
              parentId: row.parentId,
              levelPosition: row.levelPosition,
            },
            executor: tx,
          });
          return row;
        });
        return reply.status(201).send(created);
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A sibling unit with that code already exists',
          });
        }
        throw err;
      }
    },
  );

  app.patch(
    '/:id/units/:unitId',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id, unitId } = request.params as { id: string; unitId: string };
      const body = request.body as {
        name?: string;
        code?: string | null;
        sectionType?: string | null;
        sectionTypeLabel?: string | null;
        metadata?: Record<string, unknown>;
        status?: 'active' | 'inactive';
      };
      const [structure] = await db
        .select()
        .from(locationStructures)
        .where(eq(locationStructures.id, id));
      if (
        !structure ||
        !(await communityInScope(structure.communityId, user)) ||
        !can(user, 'location.write', {
          organizationId: user.orgId,
          communityId: structure.communityId,
        })
      ) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Structure not found',
        });
      }
      const [existing] = await db
        .select()
        .from(locationUnits)
        .where(and(eq(locationUnits.id, unitId), eq(locationUnits.structureId, id)));
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Unit not found',
        });
      }
      if (body.name !== undefined && !body.name.trim()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'name cannot be empty',
        });
      }
      const typeError = validateSectionType(
        body.sectionType === undefined ? existing.sectionType : body.sectionType,
        body.sectionTypeLabel === undefined
          ? existing.sectionTypeLabel
          : body.sectionTypeLabel,
      );
      if (typeError) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: typeError,
        });
      }
      if (existing.levelPosition > 1 && (body.sectionType !== undefined || body.sectionTypeLabel !== undefined)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'sectionType is only valid for root nodes',
        });
      }

      try {
        const updated = await db.transaction(async (tx) => {
          const [row] = await tx
            .update(locationUnits)
            .set({
              ...(body.name !== undefined ? { name: body.name.trim() } : {}),
              ...(body.code !== undefined ? { code: body.code?.trim() || null } : {}),
              ...(body.sectionType !== undefined
                ? { sectionType: (body.sectionType as SectionType) || null }
                : {}),
              ...(body.sectionTypeLabel !== undefined
                ? { sectionTypeLabel: body.sectionTypeLabel?.trim() || null }
                : {}),
              ...(body.metadata !== undefined ? { metadata: body.metadata } : {}),
              ...(body.status !== undefined ? { status: body.status } : {}),
              updatedAt: new Date(),
            })
            .where(eq(locationUnits.id, unitId))
            .returning();

          await auditCommunityEvent({
            request,
            communityId: structure.communityId,
            eventType: 'location_unit.updated',
            metadata: {
              structureId: structure.id,
              unitId: row.id,
              changedFields: Object.keys(body),
            },
            executor: tx,
          });
          return row;
        });
        return updated;
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A sibling unit with that code already exists',
          });
        }
        throw err;
      }
    },
  );
}
