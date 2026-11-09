import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, count, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { createDb } from '@porteria/database';
import {
  communities,
  locationResidents,
  locationStructures,
  locationUnits,
  users,
} from '@porteria/database/schema';
import { requireRole } from '../middlewares/rbac.js';
import { auditCommunityEvent } from '../services/audit.service.js';
import { can } from '../services/admin-permissions.service.js';

const db = createDb();
const parentUnit = alias(locationUnits, 'parent_unit');
const grandparentUnit = alias(locationUnits, 'grandparent_unit');

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

async function unitInScope(
  unitId: string,
  user: ReturnType<typeof getUser>,
): Promise<boolean> {
  if (user.isPlatformAdmin) return true;
  const [unit] = await db
    .select({ communityId: locationUnits.communityId, organizationId: communities.organizationId })
    .from(locationUnits)
    .innerJoin(communities, eq(locationUnits.communityId, communities.id))
    .where(eq(locationUnits.id, unitId));
  if (!unit || unit.organizationId !== user.orgId) return false;
  if (['community_admin', 'operator', 'guard'].includes(user.role) && user.communityId !== unit.communityId) return false;
  return true;
}

function unitScope(user: ReturnType<typeof getUser>, requested?: string): SQL | undefined {
  if (['community_admin', 'operator', 'guard'].includes(user.role) && user.communityId) {
    return eq(locationUnits.communityId, user.communityId);
  }
  return requested ? eq(locationUnits.communityId, requested) : undefined;
}

export async function unitRoutes(app: FastifyInstance) {
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

  app.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string | undefined>;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    for (const key of ['id', 'residentId']) {
      if (params[key] && !uuidPattern.test(params[key]!)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid identifier format',
        });
      }
    }
  });

  app.get(
    '/',
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator', 'guard')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const query = request.query as {
        communityId?: string;
        sectionId?: string;
        search?: string;
        status?: string;
        page?: string;
        pageSize?: string;
      };
      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
      if (
        !can(user, 'location.read', {
          organizationId: user.orgId,
          communityId: user.communityId ?? query.communityId,
        })
      ) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }

      const conditions: SQL[] = [
        eq(locationUnits.levelPosition, locationStructures.levelCount),
        ...(user.isPlatformAdmin
          ? []
          : [eq(communities.organizationId, user.orgId)]),
      ];
      const scope = unitScope(user, query.communityId);
      if (scope) conditions.push(scope);
      if (query.sectionId) {
        conditions.push(
          or(
            eq(parentUnit.id, query.sectionId),
            eq(grandparentUnit.id, query.sectionId),
          ) as SQL,
        );
      }
      if (query.status) {
        conditions.push(eq(locationUnits.status, query.status as 'active' | 'inactive'));
      }
      if (query.search) {
        const search = `%${query.search}%`;
        conditions.push(
          or(ilike(locationUnits.name, search), ilike(locationUnits.code, search)) as SQL,
        );
      }

      const where = and(...conditions);
      const sectionIdExpr = sql<string | null>`CASE
        WHEN ${parentUnit.levelPosition} = 1 THEN ${parentUnit.id}
        WHEN ${grandparentUnit.levelPosition} = 1 THEN ${grandparentUnit.id}
        ELSE NULL
      END`;
      const sectionNameExpr = sql<string | null>`CASE
        WHEN ${parentUnit.levelPosition} = 1 THEN ${parentUnit.name}
        WHEN ${grandparentUnit.levelPosition} = 1 THEN ${grandparentUnit.name}
        ELSE NULL
      END`;
      const pathExpr = sql<string>`concat_ws(
        ' / ',
        NULLIF(${grandparentUnit.name}, ''),
        NULLIF(${parentUnit.name}, ''),
        ${locationUnits.name}
      )`;

      const [rows, totalRows] = await Promise.all([
        db
          .select({
            id: locationUnits.id,
            communityId: locationUnits.communityId,
            communityName: communities.name,
            sectionId: sectionIdExpr,
            sectionName: sectionNameExpr,
            path: pathExpr,
            name: locationUnits.name,
            code: locationUnits.code,
            metadata: locationUnits.metadata,
            status: locationUnits.status,
            levelPosition: locationUnits.levelPosition,
          })
          .from(locationUnits)
          .innerJoin(communities, eq(locationUnits.communityId, communities.id))
          .innerJoin(
            locationStructures,
            eq(locationUnits.structureId, locationStructures.id),
          )
          .leftJoin(parentUnit, eq(locationUnits.parentId, parentUnit.id))
          .leftJoin(grandparentUnit, eq(parentUnit.parentId, grandparentUnit.id))
          .where(where)
          .orderBy(asc(communities.name), asc(locationUnits.code))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        db
          .select({ value: count() })
          .from(locationUnits)
          .innerJoin(communities, eq(locationUnits.communityId, communities.id))
          .innerJoin(
            locationStructures,
            eq(locationUnits.structureId, locationStructures.id),
          )
          .leftJoin(parentUnit, eq(locationUnits.parentId, parentUnit.id))
          .leftJoin(grandparentUnit, eq(parentUnit.parentId, grandparentUnit.id))
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
        sectionId?: string;
        code?: string;
        name?: string;
        floor?: number | null;
        type?: string;
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
      if (!body.communityId || !body.sectionId || !body.code?.trim()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'communityId, sectionId and code are required',
        });
      }
      if (!(await communityInScope(body.communityId, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Community not found',
        });
      }

      const [section] = await db
        .select({
          id: locationUnits.id,
          structureId: locationUnits.structureId,
          communityId: locationUnits.communityId,
          levelCount: locationStructures.levelCount,
        })
        .from(locationUnits)
        .innerJoin(
          locationStructures,
          eq(locationUnits.structureId, locationStructures.id),
        )
        .where(
          and(
            eq(locationUnits.id, body.sectionId),
            eq(locationUnits.communityId, body.communityId),
            eq(locationUnits.levelPosition, 1),
          ),
        );

      if (!section) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Section not found',
        });
      }
      if (section.levelCount < 2) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'A one-level structure has no child units',
        });
      }

      const floor = body.floor ?? null;
      let parentId = section.id;
      let levelPosition = 2;

      if (section.levelCount >= 3) {
        const floorName = `Piso ${floor ?? 0}`;
        let [floorNode] = await db
          .select()
          .from(locationUnits)
          .where(
            and(
              eq(locationUnits.parentId, section.id),
              eq(locationUnits.levelPosition, 2),
              eq(locationUnits.name, floorName),
            ),
          )
          .limit(1);

        if (!floorNode) {
          [floorNode] = await db
            .insert(locationUnits)
            .values({
              communityId: body.communityId,
              structureId: section.structureId,
              parentId: section.id,
              levelPosition: 2,
              name: floorName,
              metadata: {},
              status: 'active',
            })
            .returning();
        }

        parentId = floorNode.id;
        levelPosition = 3;
      }

      try {
        const [created] = await db
          .insert(locationUnits)
          .values({
            communityId: body.communityId,
            structureId: section.structureId,
            parentId,
            levelPosition,
            name: body.name?.trim() || body.code.trim(),
            code: body.code.trim(),
            metadata: { legacyFloor: floor, legacyType: body.type ?? 'apartment' },
            status: 'active',
          })
          .returning();
        return reply.status(201).send(created);
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A unit with that code already exists',
          });
        }
        throw err;
      }
    },
  );

  app.get(
    '/:id/residents',
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator', 'guard')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      if (!(await unitInScope(id, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Unit not found',
        });
      }
      return db
        .select({
          id: locationResidents.id,
          userId: locationResidents.userId,
          userName: users.name,
          userEmail: users.email,
          relationship: locationResidents.relationship,
          validFrom: locationResidents.validFrom,
          validTo: locationResidents.validTo,
          status: locationResidents.status,
        })
        .from(locationResidents)
        .innerJoin(users, eq(locationResidents.userId, users.id))
        .where(eq(locationResidents.locationUnitId, id))
        .orderBy(asc(locationResidents.createdAt));
    },
  );

  app.get(
    '/:id/residents/:residentId',
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator', 'guard')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id, residentId } = request.params as {
        id: string;
        residentId: string;
      };
      if (!(await unitInScope(id, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Unit not found',
        });
      }
      const [resident] = await db
        .select({
          id: locationResidents.id,
          locationUnitId: locationResidents.locationUnitId,
          userId: locationResidents.userId,
          userName: users.name,
          userEmail: users.email,
          relationship: locationResidents.relationship,
          validFrom: locationResidents.validFrom,
          validTo: locationResidents.validTo,
          status: locationResidents.status,
        })
        .from(locationResidents)
        .innerJoin(users, eq(locationResidents.userId, users.id))
        .where(
          and(
            eq(locationResidents.id, residentId),
            eq(locationResidents.locationUnitId, id),
          ),
        )
        .limit(1);
      if (!resident) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Resident not found',
        });
      }
      return resident;
    },
  );

  app.post(
    '/:id/residents',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const body = request.body as {
        userId?: string;
        relationship?: 'owner' | 'tenant' | 'resident' | 'family' | 'staff';
        validFrom?: string;
        validTo?: string | null;
      };
      if (!body.userId || !body.relationship) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'userId and relationship are required',
        });
      }
      if (!['owner', 'tenant', 'resident', 'family', 'staff'].includes(body.relationship)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid relationship',
        });
      }
      if (!(await unitInScope(id, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Unit not found',
        });
      }
      const residentUserId = body.userId;
      const residentRelationship = body.relationship;
      try {
        const created = await db.transaction(async (tx) => {
          const [row] = await tx
            .insert(locationResidents)
            .values({
              locationUnitId: id,
              userId: residentUserId,
              relationship: residentRelationship,
              validFrom: body.validFrom || new Date().toISOString().slice(0, 10),
              validTo: body.validTo || null,
              status: 'active',
            })
            .returning();

          const [unit] = await tx
            .select({ communityId: locationUnits.communityId })
            .from(locationUnits)
            .where(eq(locationUnits.id, id));

          if (unit) {
            await auditCommunityEvent({
              request,
              communityId: unit.communityId,
              eventType: 'location_resident.associated',
              metadata: {
                residentId: row.id,
                locationUnitId: id,
                userId: row.userId,
                relationship: row.relationship,
              },
              executor: tx,
            });
          }

          return row;
        });

        return reply.status(201).send(created);
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'Resident already associated',
          });
        }
        throw err;
      }
    },
  );

  app.get(
    '/:id/residents/:residentId/history',
    { preHandler: [requireRole('org_admin', 'community_admin', 'operator', 'guard')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id, residentId } = request.params as {
        id: string;
        residentId: string;
      };
      if (!(await unitInScope(id, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Unit not found',
        });
      }
      const [resident] = await db
        .select({ id: locationResidents.id, userId: locationResidents.userId })
        .from(locationResidents)
        .where(
          and(
            eq(locationResidents.id, residentId),
            eq(locationResidents.locationUnitId, id),
          ),
        )
        .limit(1);
      if (!resident) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Resident not found',
        });
      }
      return db
        .select({
          id: locationResidents.id,
          locationUnitId: locationResidents.locationUnitId,
          userId: locationResidents.userId,
          relationship: locationResidents.relationship,
          validFrom: locationResidents.validFrom,
          validTo: locationResidents.validTo,
          status: locationResidents.status,
          createdAt: locationResidents.createdAt,
          updatedAt: locationResidents.updatedAt,
        })
        .from(locationResidents)
        .where(
          and(
            eq(locationResidents.locationUnitId, id),
            eq(locationResidents.userId, resident.userId),
          ),
        )
        .orderBy(asc(locationResidents.validFrom));
    },
  );

  app.patch(
    '/:id/residents/:residentId',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id, residentId } = request.params as {
        id: string;
        residentId: string;
      };
      const body = request.body as {
        relationship?: 'owner' | 'tenant' | 'resident' | 'family' | 'staff';
        validFrom?: string;
        validTo?: string | null;
        status?: 'active' | 'inactive';
      };
      if (
        body.relationship !== undefined &&
        !['owner', 'tenant', 'resident', 'family', 'staff'].includes(body.relationship)
      ) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid relationship',
        });
      }
      if (body.status !== undefined && !['active', 'inactive'].includes(body.status)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid status',
        });
      }
      if (!(await unitInScope(id, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Unit not found',
        });
      }
      const [existing] = await db
        .select()
        .from(locationResidents)
        .where(
          and(
            eq(locationResidents.id, residentId),
            eq(locationResidents.locationUnitId, id),
          ),
        );
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Resident not found',
        });
      }

      const nextStatus = body.status ?? existing.status;
      const endDate =
        nextStatus === 'inactive'
          ? body.validTo ?? existing.validTo ?? new Date().toISOString().slice(0, 10)
          : body.validTo ?? existing.validTo;

      try {
        const updated = await db.transaction(async (tx) => {
          const [row] = await tx
            .update(locationResidents)
            .set({
              ...(body.relationship !== undefined ? { relationship: body.relationship } : {}),
              ...(body.validFrom !== undefined ? { validFrom: body.validFrom } : {}),
              validTo: endDate,
              ...(body.status !== undefined ? { status: body.status } : {}),
              updatedAt: new Date(),
            })
            .where(eq(locationResidents.id, residentId))
            .returning();

          const [unit] = await tx
            .select({ communityId: locationUnits.communityId })
            .from(locationUnits)
            .where(eq(locationUnits.id, id));
          if (unit) {
            await auditCommunityEvent({
              request,
              communityId: unit.communityId,
              eventType:
                nextStatus === 'inactive'
                  ? 'location_resident.ended'
                  : 'location_resident.updated',
              metadata: {
                residentId: row.id,
                locationUnitId: id,
                userId: row.userId,
                relationship: row.relationship,
                status: row.status,
                validTo: row.validTo,
              },
              executor: tx,
            });
          }
          return row;
        });
        return updated;
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'Resident association already exists',
          });
        }
        throw err;
      }
    },
  );
}
