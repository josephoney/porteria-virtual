import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  communities,
  locationResidents,
  locationStructures,
  locationUnits,
} from '@porteria/database/schema';
import { requireRole } from '../middlewares/rbac.js';
import { auditCommunityEvent } from '../services/audit.service.js';
import { can } from '../services/admin-permissions.service.js';
import {
  collectDescendants,
  collectSubtree,
  type LiteNode,
} from '../services/location-tree.service.js';

const db = createDb();

const SECTION_TYPES = [
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

type SectionType = (typeof SECTION_TYPES)[number];

function getUser(request: FastifyRequest) {
  const u = request.user;
  return {
    role: u.role,
    orgId: u.orgId,
    communityId: u.communityId ?? null,
    isPlatformAdmin: Boolean(u.isPlatformAdmin),
  };
}

function parseSectionType(value: unknown): SectionType | null {
  return SECTION_TYPES.includes(value as SectionType) ? (value as SectionType) : null;
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

async function nodeInScope(
  nodeId: string,
  user: ReturnType<typeof getUser>,
): Promise<boolean> {
  if (user.isPlatformAdmin) return true;
  const [node] = await db
    .select({
      communityId: locationUnits.communityId,
      organizationId: communities.organizationId,
    })
    .from(locationUnits)
    .innerJoin(communities, eq(locationUnits.communityId, communities.id))
    .where(eq(locationUnits.id, nodeId));
  if (!node || node.organizationId !== user.orgId) return false;
  if (user.role === 'community_admin' && user.communityId !== node.communityId) return false;
  return true;
}

async function getStructure(structureId: string) {
  const [structure] = await db
    .select()
    .from(locationStructures)
    .where(eq(locationStructures.id, structureId));
  return structure ?? null;
}

async function getStructureNodes(structureId: string): Promise<LiteNode[]> {
  return db
    .select({
      id: locationUnits.id,
      parentId: locationUnits.parentId,
      levelPosition: locationUnits.levelPosition,
    })
    .from(locationUnits)
    .where(eq(locationUnits.structureId, structureId));
}

export async function locationNodeRoutes(app: FastifyInstance) {
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

  app.get(
    '/',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const query = request.query as { communityId?: string; structureId?: string };
      if (
        !can(user, 'location.read', {
          organizationId: user.orgId,
          communityId: query.communityId ?? user.communityId,
        })
      ) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
      if (!query.communityId) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'communityId is required',
        });
      }
      if (!(await communityInScope(query.communityId, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Community not found',
        });
      }
      const conditions = [eq(locationUnits.communityId, query.communityId)];
      if (query.structureId) {
        conditions.push(eq(locationUnits.structureId, query.structureId));
      }
      return db
        .select({
          id: locationUnits.id,
          communityId: locationUnits.communityId,
          structureId: locationUnits.structureId,
          parentId: locationUnits.parentId,
          levelPosition: locationUnits.levelPosition,
          name: locationUnits.name,
          code: locationUnits.code,
          sectionType: locationUnits.sectionType,
          sectionTypeLabel: locationUnits.sectionTypeLabel,
          status: locationUnits.status,
        })
        .from(locationUnits)
        .where(and(...conditions))
        .orderBy(asc(locationUnits.levelPosition), asc(locationUnits.name));
    },
  );

  async function setSubtreeStatus(
    request: FastifyRequest,
    reply: FastifyReply,
    status: 'active' | 'inactive',
  ) {
    const user = getUser(request);
    const { id } = request.params as { id: string };

    const [existing] = await db
      .select({
        id: locationUnits.id,
        communityId: locationUnits.communityId,
        structureId: locationUnits.structureId,
        status: locationUnits.status,
      })
      .from(locationUnits)
      .where(eq(locationUnits.id, id));
    if (
      !existing ||
      !(await nodeInScope(id, user)) ||
      !can(user, 'location.write', {
        organizationId: user.orgId,
        communityId: existing.communityId,
      })
    ) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Node not found',
      });
    }

    const allNodes = await getStructureNodes(existing.structureId);
    const subtree = collectSubtree(id, allNodes);

    return db.transaction(async (tx) => {
      await tx
        .update(locationUnits)
        .set({ status, updatedAt: new Date() })
        .where(inArray(locationUnits.id, subtree));

      await auditCommunityEvent({
        request,
        communityId: existing.communityId,
        eventType: status === 'inactive' ? 'location_node.archived' : 'location_node.restored',
        metadata: { nodeId: id, status, affected: subtree.length },
        executor: tx,
      });

      return {
        id,
        status,
        affected: subtree.length,
      };
    });
  }

  app.post(
    '/:id/archive',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) =>
      setSubtreeStatus(request, reply, 'inactive'),
  );

  app.post(
    '/:id/restore',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) =>
      setSubtreeStatus(request, reply, 'active'),
  );

  app.post(
    '/',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const body = request.body as {
        communityId?: string;
        structureId?: string;
        parentId?: string | null;
        name?: string;
        code?: string | null;
        sectionType?: string;
        sectionTypeLabel?: string | null;
      };
      if (
        !can(user, 'location.write', {
          organizationId: user.orgId,
          communityId: body.communityId,
        })
      ) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
      if (!body.communityId || !body.name?.trim()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'communityId and name are required',
        });
      }
      if (!(await communityInScope(body.communityId, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Community not found',
        });
      }

      let structureId = body.structureId;
      let levelPosition = 1;
      if (body.parentId) {
        const [parent] = await db
          .select()
          .from(locationUnits)
          .where(eq(locationUnits.id, body.parentId));
        if (!parent || parent.communityId !== body.communityId) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Parent node not found',
          });
        }
        structureId = parent.structureId;
        levelPosition = parent.levelPosition + 1;
      }

      if (!structureId) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'structureId is required for a root node',
        });
      }
      const structure = await getStructure(structureId);
      if (!structure || structure.communityId !== body.communityId) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Structure not found',
        });
      }
      if (levelPosition > structure.levelCount) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: `This structure only supports ${structure.levelCount} levels`,
        });
      }

      let sectionType: SectionType | null = null;
      let sectionTypeLabel: string | null = null;
      if (levelPosition === 1) {
        sectionType = parseSectionType(body.sectionType) ?? 'other';
        sectionTypeLabel =
          sectionType === 'other'
            ? body.sectionTypeLabel?.trim() || 'Otra'
            : null;
      }

      const communityId = body.communityId;
      const nodeName = body.name.trim();
      const resolvedStructureId = structureId;

      try {
        const created = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(locationUnits)
            .values({
              communityId,
              structureId: resolvedStructureId,
              parentId: body.parentId ?? null,
              levelPosition,
              name: nodeName,
              code: body.code?.trim() || null,
              sectionType,
              sectionTypeLabel,
              metadata: {},
              status: 'active',
            })
            .returning();

          await auditCommunityEvent({
            request,
            communityId,
            eventType: 'location_node.created',
            metadata: {
              nodeId: row.id,
              structureId: row.structureId,
              parentId: row.parentId,
              levelPosition: row.levelPosition,
              name: row.name,
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
            message: 'A node with that code already exists at this level',
          });
        }
        throw err;
      }
    },
  );

  async function handleUpdateNode(request: FastifyRequest, reply: FastifyReply) {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const body = request.body as {
        name?: string;
        code?: string | null;
        parentId?: string | null;
        status?: 'active' | 'inactive';
        sectionType?: string;
        sectionTypeLabel?: string | null;
      };
      let subtreeIds: string[] = [];
      let subtreeDelta = 0;

      const [existing] = await db
        .select()
        .from(locationUnits)
        .where(eq(locationUnits.id, id));
      if (
        !existing ||
        !(await nodeInScope(id, user)) ||
        !can(user, 'location.write', {
          organizationId: user.orgId,
          communityId: existing.communityId,
        })
      ) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Node not found',
        });
      }

      const patch: Partial<typeof locationUnits.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (body.name !== undefined) patch.name = body.name.trim();
      if (body.code !== undefined) patch.code = body.code?.trim() || null;
      if (body.status !== undefined) patch.status = body.status;

      if (body.sectionType !== undefined) {
        const sectionType = parseSectionType(body.sectionType);
        if (!sectionType) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Invalid sectionType',
          });
        }
        patch.sectionType = sectionType;
        patch.sectionTypeLabel =
          sectionType === 'other' ? body.sectionTypeLabel?.trim() || 'Otra' : null;
      }

      if (body.parentId !== undefined) {
        if (body.parentId === id) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'A node cannot be its own parent',
          });
        }
        const structure = await getStructure(existing.structureId);
        if (!structure) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'Structure not found',
          });
        }

        let newLevel = 1;
        if (body.parentId) {
          const [parent] = await db
            .select()
            .from(locationUnits)
            .where(eq(locationUnits.id, body.parentId));
          if (
            !parent ||
            parent.structureId !== existing.structureId ||
            parent.communityId !== existing.communityId
          ) {
            return reply.status(404).send({
              statusCode: 404,
              error: 'Not Found',
              message: 'Parent node not found',
            });
          }
          newLevel = parent.levelPosition + 1;
        }

        if (newLevel > structure.levelCount) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: `This structure only supports ${structure.levelCount} levels`,
          });
        }

        const allNodes = await getStructureNodes(existing.structureId);
        const descendants = collectDescendants(existing.id, allNodes);
        if (body.parentId && descendants.some((node) => node.id === body.parentId)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'Cannot move a node inside its own subtree',
          });
        }

        const relativeDepth =
          descendants.length > 0
            ? Math.max(...descendants.map((node) => node.levelPosition)) -
              existing.levelPosition
            : 0;
        if (newLevel + relativeDepth > structure.levelCount) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Bad Request',
            message: 'The subtree would exceed the structure level count',
          });
        }

        const delta = newLevel - existing.levelPosition;
        patch.parentId = body.parentId;
        patch.levelPosition = newLevel;
        subtreeIds = descendants.map((node) => node.id);
        subtreeDelta = delta;
      }

      try {
        const updated = await db.transaction(async (tx) => {
          if (subtreeIds.length > 0 && subtreeDelta !== 0) {
            await tx
              .update(locationUnits)
              .set({
                levelPosition: sql`${locationUnits.levelPosition} + ${subtreeDelta}`,
                updatedAt: new Date(),
              })
              .where(inArray(locationUnits.id, subtreeIds));
          }

          const [row] = await tx
            .update(locationUnits)
            .set(patch)
            .where(eq(locationUnits.id, id))
            .returning();

          await auditCommunityEvent({
            request,
            communityId: existing.communityId,
            eventType: 'location_node.updated',
            metadata: {
              nodeId: id,
              changedFields: Object.keys(body),
              parentId: row.parentId,
              levelPosition: row.levelPosition,
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
            message: 'A node with that code already exists at this level',
          });
        }
        throw err;
      }
  }

  app.patch(
    '/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    handleUpdateNode,
  );

  app.post(
    '/:id/move',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { parentId?: string | null };
      if (body.parentId === undefined) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'parentId is required',
        });
      }
      return handleUpdateNode(request, reply);
    },
  );

  app.delete(
    '/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const [existing] = await db
        .select({
          id: locationUnits.id,
          communityId: locationUnits.communityId,
          structureId: locationUnits.structureId,
          parentId: locationUnits.parentId,
          levelPosition: locationUnits.levelPosition,
          name: locationUnits.name,
          code: locationUnits.code,
        })
        .from(locationUnits)
        .where(eq(locationUnits.id, id));
      if (
        !existing ||
        !(await nodeInScope(id, user)) ||
        !can(user, 'location.write', {
          organizationId: user.orgId,
          communityId: existing.communityId,
        })
      ) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Node not found',
        });
      }

      const [childCount] = await db
        .select({ value: count() })
        .from(locationUnits)
        .where(eq(locationUnits.parentId, id));
      if ((childCount?.value ?? 0) > 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Cannot delete a node with children',
        });
      }

      const [residentCount] = await db
        .select({ value: count() })
        .from(locationResidents)
        .where(eq(locationResidents.locationUnitId, id));
      if ((residentCount?.value ?? 0) > 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Cannot delete a node with residents',
        });
      }

      await db.transaction(async (tx) => {
        await tx.delete(locationUnits).where(eq(locationUnits.id, id));

        await auditCommunityEvent({
          request,
          communityId: existing.communityId,
          eventType: 'location_node.deleted',
          metadata: {
            nodeId: id,
            structureId: existing.structureId,
            parentId: existing.parentId,
            levelPosition: existing.levelPosition,
            name: existing.name,
            code: existing.code,
          },
          executor: tx,
        });
      });

      return reply.status(204).send();
    },
  );
}
