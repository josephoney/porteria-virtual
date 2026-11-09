import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { and, count, eq, ilike, inArray } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  organizations,
  communities,
  buildings,
  units,
  memberships,
  people,
  accounts,
  users,
  invitations,
  locationStructures,
  locationUnits,
} from '@porteria/database/schema';
import { requirePlatformAdmin } from '../middlewares/rbac.js';
import * as slugService from '../services/slug.service.js';
import * as invitationService from '../services/invitation.service.js';
import * as eventsService from '../services/events.service.js';
import * as usersService from '../services/users.service.js';
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  createCommunitySchema,
  updateCommunitySchema,
  createPlatformBuildingSchema,
  createPlatformUnitSchema,
  inviteOrgAdminSchema,
} from '../schemas/index.js';

const db = createDb();

function getRequester(request: FastifyRequest): invitationService.InvitationRequester {
  const u = request.user;
  return {
    sub: u.sub,
    role: 'platform_admin',
    orgId: '',
    communityId: null,
    isPlatformAdmin: true,
  };
}

function pagination(request: FastifyRequest) {
  const query = request.query as { page?: string; pageSize?: string };
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const pageSize = Math.min(Math.max(parseInt(query.pageSize || '20', 10), 1), 100);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function audit(
  request: FastifyRequest,
  eventType: string,
  organizationId: string,
  communityId: string | null,
  metadata: Record<string, unknown>,
) {
  eventsService
    .insertEvent({
      eventType,
      actorId: request.user.sub,
      actorRole: 'platform_admin',
      organizationId,
      communityId,
      metadata,
    })
    .catch(() => {});
}

function errorInfo(err: unknown): { status: number; message: string } {
  if (err instanceof slugService.InvalidSlugError) {
    return { status: 400, message: err.message };
  }
  if ((err as { code?: string }).code === '23505') {
    return { status: 409, message: 'Slug or code already in use' };
  }
  return { status: 500, message: 'Unexpected error' };
}

export async function platformRoutes(app: FastifyInstance) {
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

  app.addHook('preHandler', requirePlatformAdmin());

  const readOnlyTenant = async (_request: FastifyRequest, reply: FastifyReply) =>
    reply.status(403).send({
      statusCode: 403,
      error: 'Forbidden',
      message: 'Platform administrators have read-only tenant access',
    });

  app.get('/users', async (request: FastifyRequest) => {
    const { page, pageSize } = pagination(request);
    const query = request.query as { search?: string };
    return usersService.listUsers(
      { sub: request.user.sub, role: 'platform_admin', orgId: '', communityId: null, isPlatformAdmin: true },
      { page, pageSize, search: query.search },
    );
  });

  // Organizations
  app.get('/organizations', async (request: FastifyRequest) => {
    const { page, pageSize, offset } = pagination(request);
    const query = request.query as { search?: string };
    const where = query.search ? ilike(organizations.name, `%${query.search}%`) : undefined;

    const [data, totalRow] = await Promise.all([
      db
        .select({ id: organizations.id, name: organizations.name, slug: organizations.slug, createdAt: organizations.createdAt })
        .from(organizations)
        .where(where)
        .orderBy(organizations.name)
        .limit(pageSize)
        .offset(offset),
      db.select({ count: count() }).from(organizations).where(where),
    ]);

    return { data, total: totalRow[0]?.count ?? 0, page, pageSize };
  });

  app.get('/organizations/:id/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [organization] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        nit: organizations.nit,
        phone: organizations.phone,
        address: organizations.address,
        logoAssetId: organizations.logoAssetId,
        welcomeMessage: organizations.welcomeMessage,
        profileCompletedAt: organizations.profileCompletedAt,
      })
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!organization) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Organization not found',
      });
    }

    const [legalRepresentative] = await db
      .select({
        id: people.id,
        firstName: people.firstName,
        lastName: people.lastName,
        documentType: people.documentType,
        documentNumber: people.documentNumber,
        phone: people.phone,
        contactEmail: people.contactEmail,
      })
      .from(organizations)
      .innerJoin(people, eq(organizations.legalRepresentativePersonId, people.id))
      .where(eq(organizations.id, id))
      .limit(1);

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
          eq(memberships.organizationId, id),
          eq(memberships.role, 'org_admin'),
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
          eq(invitations.organizationId, id),
          eq(invitations.role, 'org_admin'),
          eq(invitations.status, 'pending'),
        ),
      )
      .limit(1);

    const organizationCommunities = await db
      .select({
        id: communities.id,
        name: communities.name,
        slug: communities.slug,
        address: communities.address,
        phone: communities.phone,
        type: communities.type,
        status: communities.status,
      })
      .from(communities)
      .where(eq(communities.organizationId, id))
      .orderBy(communities.name);

    const communityIds = organizationCommunities.map((community) => community.id);
    const [structureRows, nodeRows] = communityIds.length
      ? await Promise.all([
          db
            .select({
              id: locationStructures.id,
              communityId: locationStructures.communityId,
              levelCount: locationStructures.levelCount,
            })
            .from(locationStructures)
            .where(inArray(locationStructures.communityId, communityIds)),
          db
            .select({
              id: locationUnits.id,
              communityId: locationUnits.communityId,
              parentId: locationUnits.parentId,
              levelPosition: locationUnits.levelPosition,
            })
            .from(locationUnits)
            .where(inArray(locationUnits.communityId, communityIds)),
        ])
      : [[], []];

    const levelByStructure = new Map(
      structureRows.map((structure) => [structure.id, structure.levelCount]),
    );
    const structureByCommunity = new Map(
      structureRows.map((structure) => [structure.communityId, structure]),
    );
    const nodesByCommunity = new Map<string, typeof nodeRows>();
    for (const node of nodeRows) {
      const list = nodesByCommunity.get(node.communityId) ?? [];
      list.push(node);
      nodesByCommunity.set(node.communityId, list);
    }

    const countsByCommunity = new Map<
      string,
      { sectionCount: number; unitCount: number }
    >();
    for (const communityId of communityIds) {
      const nodes = nodesByCommunity.get(communityId) ?? [];
      const structure = structureByCommunity.get(communityId);
      const levelCount = structure
        ? (levelByStructure.get(structure.id) ?? 3)
        : 3;
      const sections = nodes.filter((node) => node.levelPosition === 1);
      const unitCount = nodes.filter((node) => node.levelPosition === levelCount).length;
      countsByCommunity.set(communityId, {
        sectionCount: sections.length,
        unitCount,
      });
    }

    return {
      organization,
      legalRepresentative: legalRepresentative ?? null,
      administrator: administrator ?? null,
      pendingAdministrator: pendingAdministrator ?? null,
      communities: organizationCommunities.map((community) => ({
        ...community,
        ...(countsByCommunity.get(community.id) ?? {
          sectionCount: 0,
          unitCount: 0,
        }),
      })),
    };
  });

  app.post('/organizations', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createOrganizationSchema.parse(request.body);
    try {
      const slug = await slugService.uniqueOrganizationSlug(body.slug, body.name);
      const [created] = await db
        .insert(organizations)
        .values({ name: body.name, slug })
        .returning();
      audit(request, 'organization.created', created.id, null, { slug: created.slug });
      return reply.status(201).send(created);
    } catch (err) {
      const info = errorInfo(err);
      return reply.status(info.status).send({ error: info.message });
    }
  });

  app.patch('/organizations/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateOrganizationSchema.parse(request.body);
    const [existing] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!existing) return reply.status(404).send({ error: 'Organization not found' });

    try {
      const slug = body.slug
        ? await slugService.uniqueOrganizationSlug(body.slug, existing.name, id)
        : existing.slug;
      const [updated] = await db
        .update(organizations)
        .set({ name: body.name ?? existing.name, slug, updatedAt: new Date() })
        .where(eq(organizations.id, id))
        .returning();
      audit(request, 'organization.updated', updated.id, null, { slug: updated.slug });
      return updated;
    } catch (err) {
      const info = errorInfo(err);
      return reply.status(info.status).send({ error: info.message });
    }
  });

  // Communities
  app.get('/communities', async (request: FastifyRequest) => {
    const { page, pageSize, offset } = pagination(request);
    const query = request.query as { organizationId?: string };
    const where = query.organizationId ? eq(communities.organizationId, query.organizationId) : undefined;

    const [data, totalRow] = await Promise.all([
      db
        .select({
          id: communities.id,
          name: communities.name,
          slug: communities.slug,
          address: communities.address,
          timezone: communities.timezone,
          status: communities.status,
          organizationId: communities.organizationId,
          organizationName: organizations.name,
        })
        .from(communities)
        .innerJoin(organizations, eq(communities.organizationId, organizations.id))
        .where(where)
        .orderBy(communities.name)
        .limit(pageSize)
        .offset(offset),
      db.select({ count: count() }).from(communities).where(where),
    ]);

    return { data, total: totalRow[0]?.count ?? 0, page, pageSize };
  });

  app.post('/communities', { preHandler: [readOnlyTenant] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createCommunitySchema.parse(request.body);
    const [org] = await db.select().from(organizations).where(eq(organizations.id, body.organizationId)).limit(1);
    if (!org) return reply.status(400).send({ error: 'Organization not found' });

    try {
      const slug = await slugService.uniqueCommunitySlug(body.slug, body.name);
      const [created] = await db
        .insert(communities)
        .values({
          name: body.name,
          slug,
          address: body.address,
          timezone: body.timezone,
          organizationId: body.organizationId,
        })
        .returning();
      audit(request, 'community.created', created.organizationId, created.id, { slug: created.slug });
      return reply.status(201).send(created);
    } catch (err) {
      const info = errorInfo(err);
      return reply.status(info.status).send({ error: info.message });
    }
  });

  app.patch('/communities/:id', { preHandler: [readOnlyTenant] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateCommunitySchema.parse(request.body);
    const [existing] = await db.select().from(communities).where(eq(communities.id, id)).limit(1);
    if (!existing) return reply.status(404).send({ error: 'Community not found' });

    try {
      const slug = body.slug
        ? await slugService.uniqueCommunitySlug(body.slug, existing.name, id)
        : existing.slug;
      const [updated] = await db
        .update(communities)
        .set({
          name: body.name ?? existing.name,
          address: body.address ?? existing.address,
          timezone: body.timezone ?? existing.timezone,
          status: body.status ?? existing.status,
          slug,
          updatedAt: new Date(),
        })
        .where(eq(communities.id, id))
        .returning();
      audit(request, 'community.updated', updated.organizationId, updated.id, { slug: updated.slug });
      return updated;
    } catch (err) {
      const info = errorInfo(err);
      return reply.status(info.status).send({ error: info.message });
    }
  });

  // Buildings
  app.get('/buildings', async (request: FastifyRequest) => {
    const { page, pageSize, offset } = pagination(request);
    const query = request.query as { communityId?: string };
    const where = query.communityId ? eq(buildings.communityId, query.communityId) : undefined;

    const [data, totalRow] = await Promise.all([
      db.select().from(buildings).where(where).orderBy(buildings.name).limit(pageSize).offset(offset),
      db.select({ count: count() }).from(buildings).where(where),
    ]);

    return { data, total: totalRow[0]?.count ?? 0, page, pageSize };
  });

  app.post('/buildings', { preHandler: [readOnlyTenant] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createPlatformBuildingSchema.parse(request.body);
    const [community] = await db.select().from(communities).where(eq(communities.id, body.communityId)).limit(1);
    if (!community) return reply.status(400).send({ error: 'Community not found' });

    try {
      const [created] = await db
        .insert(buildings)
        .values({
          communityId: body.communityId,
          name: body.name,
          code: body.code ?? null,
          floors: body.floors ?? null,
        })
        .returning();
      audit(request, 'building.created', community.organizationId, community.id, { buildingId: created.id });
      return reply.status(201).send(created);
    } catch (err) {
      const info = errorInfo(err);
      return reply.status(info.status).send({ error: info.message });
    }
  });

  app.patch('/buildings/:id', { preHandler: [readOnlyTenant] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = createPlatformBuildingSchema.partial().parse(request.body);
    const [existing] = await db.select().from(buildings).where(eq(buildings.id, id)).limit(1);
    if (!existing) return reply.status(404).send({ error: 'Building not found' });

    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, existing.communityId))
      .limit(1);

    const [updated] = await db
      .update(buildings)
      .set({
        name: body.name ?? existing.name,
        code: body.code !== undefined ? body.code : existing.code,
        floors: body.floors !== undefined ? body.floors : existing.floors,
        updatedAt: new Date(),
      })
      .where(eq(buildings.id, id))
      .returning();

    if (community) {
      audit(request, 'building.updated', community.organizationId, community.id, { buildingId: id });
    }
    return updated;
  });

  // Units
  app.get('/units', async (request: FastifyRequest) => {
    const { page, pageSize, offset } = pagination(request);
    const query = request.query as { communityId?: string; buildingId?: string };
    const conditions = [];
    if (query.communityId) conditions.push(eq(units.communityId, query.communityId));
    if (query.buildingId) conditions.push(eq(units.buildingId, query.buildingId));
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, totalRow] = await Promise.all([
      db.select().from(units).where(where).orderBy(units.code).limit(pageSize).offset(offset),
      db.select({ count: count() }).from(units).where(where),
    ]);

    return { data, total: totalRow[0]?.count ?? 0, page, pageSize };
  });

  app.post('/units', { preHandler: [readOnlyTenant] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createPlatformUnitSchema.parse(request.body);
    const [community] = await db.select().from(communities).where(eq(communities.id, body.communityId)).limit(1);
    if (!community) return reply.status(400).send({ error: 'Community not found' });

    if (body.buildingId) {
      const [building] = await db.select().from(buildings).where(eq(buildings.id, body.buildingId)).limit(1);
      if (!building || building.communityId !== body.communityId) {
        return reply.status(400).send({ error: 'Building does not belong to the community' });
      }
    }

    try {
      const [created] = await db
        .insert(units)
        .values({
          communityId: body.communityId,
          buildingId: body.buildingId ?? null,
          code: body.code,
          floor: body.floor ?? null,
          type: body.type,
        })
        .returning();
      audit(request, 'unit.created', community.organizationId, community.id, { unitId: created.id, code: created.code });
      return reply.status(201).send(created);
    } catch (err) {
      const info = errorInfo(err);
      return reply.status(info.status).send({ error: info.message });
    }
  });

  app.patch('/units/:id', { preHandler: [readOnlyTenant] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = createPlatformUnitSchema.partial().parse(request.body);
    const [existing] = await db.select().from(units).where(eq(units.id, id)).limit(1);
    if (!existing) return reply.status(404).send({ error: 'Unit not found' });

    const [community] = await db
      .select()
      .from(communities)
      .where(eq(communities.id, existing.communityId))
      .limit(1);

    const [updated] = await db
      .update(units)
      .set({
        code: body.code ?? existing.code,
        floor: body.floor !== undefined ? body.floor : existing.floor,
        type: body.type ?? existing.type,
        buildingId: body.buildingId !== undefined ? body.buildingId : existing.buildingId,
        updatedAt: new Date(),
      })
      .where(eq(units.id, id))
      .returning();

    if (community) {
      audit(request, 'unit.updated', community.organizationId, community.id, { unitId: id });
    }
    return updated;
  });

  // Invite the first org_admin
  app.post('/organizations/:id/invitations', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = inviteOrgAdminSchema.parse(request.body);
    const [org] = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    if (!org) return reply.status(404).send({ error: 'Organization not found' });

    const result = await invitationService.createInvitation(
      { email: body.email, role: 'org_admin', organizationId: id },
      getRequester(request),
    );

    if (!result.ok) {
      return reply.status(400).send({ error: result.code });
    }

    audit(request, 'invitation.created', org.id, null, {
      invitationId: result.data.invitation.id,
      role: 'org_admin',
    });
    return reply.status(201).send(result.data);
  });
}
