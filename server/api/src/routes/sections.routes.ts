import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, count, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  communities,
  locationStructures,
  locationUnits,
} from '@porteria/database/schema';
import { requireRole } from '../middlewares/rbac.js';
import { auditCommunityEvent } from '../services/audit.service.js';
import { can } from '../services/admin-permissions.service.js';

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
  if (['community_admin', 'operator', 'guard'].includes(user.role) && user.communityId !== communityId) return false;
  return true;
}

function sectionScope(user: ReturnType<typeof getUser>, requested?: string): SQL | undefined {
  if (['community_admin', 'operator', 'guard'].includes(user.role) && user.communityId) {
    return eq(locationUnits.communityId, user.communityId);
  }
  return requested ? eq(locationUnits.communityId, requested) : undefined;
}

export async function sectionRoutes(app: FastifyInstance) {
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
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator', 'guard')] },
    async (request: FastifyRequest) => {
      const user = getUser(request);
      const query = request.query as {
        communityId?: string;
        type?: string;
        search?: string;
        page?: string;
        pageSize?: string;
      };
      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));

      const conditions: SQL[] = [eq(locationUnits.levelPosition, 1)];
      if (!user.isPlatformAdmin) {
        conditions.push(eq(communities.organizationId, user.orgId));
      }
      const scope = sectionScope(user, query.communityId);
      if (scope) conditions.push(scope);
      if (query.type && parseSectionType(query.type)) {
        conditions.push(eq(locationUnits.sectionType, query.type as SectionType));
      }
      if (query.search) {
        const search = `%${query.search}%`;
        conditions.push(
          or(ilike(locationUnits.name, search), ilike(locationUnits.code, search)) as SQL,
        );
      }

      const where = and(...conditions);
      const [rows, totalRows] = await Promise.all([
        db
          .select({
            id: locationUnits.id,
            communityId: locationUnits.communityId,
            communityName: communities.name,
            structureId: locationUnits.structureId,
            levelCount: locationStructures.levelCount,
            name: locationUnits.name,
            code: locationUnits.code,
            sectionType: locationUnits.sectionType,
            sectionTypeLabel: locationUnits.sectionTypeLabel,
            status: locationUnits.status,
            levelPosition: locationUnits.levelPosition,
            unitCount: sql<number>`(
              SELECT count(*)::int
              FROM location_units AS leaf
              WHERE leaf.structure_id = ${locationUnits.structureId}
                AND (
                  (${locationStructures.levelCount} = 1 AND leaf.id = ${locationUnits.id})
                  OR (
                    ${locationStructures.levelCount} > 1
                    AND leaf.level_position = ${locationStructures.levelCount}
                    AND (
                      leaf.parent_id = ${locationUnits.id}
                      OR leaf.parent_id IN (
                        SELECT child.id
                        FROM location_units AS child
                        WHERE child.parent_id = ${locationUnits.id}
                      )
                    )
                  )
                )
            )`,
          })
          .from(locationUnits)
          .innerJoin(communities, eq(locationUnits.communityId, communities.id))
          .innerJoin(locationStructures, eq(locationUnits.structureId, locationStructures.id))
          .where(where)
          .orderBy(asc(communities.name), asc(locationUnits.name))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ value: count() })
          .from(locationUnits)
          .innerJoin(communities, eq(locationUnits.communityId, communities.id))
          .where(where),
      ]);

      return {
        data: rows,
        total: totalRows[0]?.value ?? 0,
        page,
        pageSize,
      };
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
      const sectionType = parseSectionType(body.sectionType);
      if (!body.communityId || !body.name?.trim() || !sectionType) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'communityId, name and a valid sectionType are required',
        });
      }
      if (sectionType === 'other' && !body.sectionTypeLabel?.trim()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'sectionTypeLabel is required when sectionType is other',
        });
      }
      if (!(await communityInScope(body.communityId, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Community not found',
        });
      }

      let [structure] = await db
        .select()
        .from(locationStructures)
        .where(
          and(
            eq(locationStructures.communityId, body.communityId),
            eq(locationStructures.name, 'Estructura principal'),
          ),
        );

      if (!structure) {
        [structure] = await db
          .insert(locationStructures)
          .values({
            communityId: body.communityId,
            name: 'Estructura principal',
            levelCount: 3,
            level1Name: 'Sección',
            level2Name: 'Piso',
            level3Name: 'Unidad',
          })
          .returning();
      }

      const sectionName = body.name.trim();
      const sectionCommunityId = body.communityId;
      const sectionTypeLabel =
        sectionType === 'other' ? body.sectionTypeLabel?.trim() || null : null;

      try {
        const created = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(locationUnits)
            .values({
              communityId: sectionCommunityId,
              structureId: structure.id,
              parentId: null,
              levelPosition: 1,
              name: sectionName,
              code: body.code?.trim() || null,
              sectionType,
              sectionTypeLabel,
              metadata: {},
              status: 'active',
            })
            .returning();

          await auditCommunityEvent({
            request,
            communityId: row.communityId,
            eventType: 'location_section.created',
            metadata: {
              sectionId: row.id,
              name: row.name,
              sectionType: row.sectionType,
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
            message: 'A section with that code already exists',
          });
        }
        throw err;
      }
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
        })
        .from(locationUnits)
        .where(and(eq(locationUnits.id, id), eq(locationUnits.levelPosition, 1)));

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
          message: 'Section not found',
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
          message: 'Cannot delete a section with nodes',
        });
      }

      await db.transaction(async (tx) => {
        await tx.delete(locationUnits).where(eq(locationUnits.id, id));

        await auditCommunityEvent({
          request,
          communityId: existing.communityId,
          eventType: 'location_section.deleted',
          metadata: { sectionId: id },
          executor: tx,
        });
      });

      return reply.status(204).send();
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
        code?: string | null;
        sectionType?: string;
        sectionTypeLabel?: string | null;
        status?: 'active' | 'inactive';
      };

      const [existing] = await db
        .select({
          id: locationUnits.id,
          communityId: locationUnits.communityId,
        })
        .from(locationUnits)
        .where(and(eq(locationUnits.id, id), eq(locationUnits.levelPosition, 1)));

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
          message: 'Section not found',
        });
      }

      const patch: Partial<typeof locationUnits.$inferInsert> = {};
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
          sectionType === 'other' ? body.sectionTypeLabel?.trim() || null : null;
      }

      return db.transaction(async (tx) => {
        const [updated] = await tx
          .update(locationUnits)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(locationUnits.id, id))
          .returning();

        await auditCommunityEvent({
          request,
          communityId: updated.communityId,
          eventType: 'location_section.updated',
          metadata: {
            sectionId: updated.id,
            changedFields: Object.keys(body),
            status: updated.status,
          },
          executor: tx,
        });

        return updated;
      });
    },
  );
}
