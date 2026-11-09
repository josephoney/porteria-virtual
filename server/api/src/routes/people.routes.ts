import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  accounts,
  communities,
  locationUnits,
  memberships,
  people,
  refreshTokens,
  users,
} from '@porteria/database/schema';
import bcrypt from 'bcryptjs';
import { requireRole } from '../middlewares/rbac.js';
import { insertEvent } from '../services/events.service.js';
import { can } from '../services/admin-permissions.service.js';

const db = createDb();

function mask(value: string | null, visible = 4): string | null {
  if (!value) return null;
  if (value.length <= visible) return '*'.repeat(value.length);
  return `${value.slice(0, visible)}${'*'.repeat(Math.max(1, value.length - visible))}`;
}

function toPublicAccount(account: typeof accounts.$inferSelect) {
  return {
    id: account.id,
    personId: account.personId,
    email: account.email,
    active: account.active,
    isPlatformAdmin: account.isPlatformAdmin,
    lastLoginAt: account.lastLoginAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function toPublicPerson(person: typeof people.$inferSelect) {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    documentType: person.documentType,
    documentNumber: mask(person.documentNumber),
    phone: mask(person.phone),
    contactEmail: person.contactEmail,
    status: person.status,
  };
}

export async function peopleRoutes(app: FastifyInstance) {
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
      const u = request.user;
      if (!can(u, 'people.read', { organizationId: u.orgId, communityId: u.communityId ?? null })) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
      const query = request.query as { search?: string; pageSize?: string };
      const pageSize = Math.min(Math.max(Number(query.pageSize) || 100, 1), 100);
      const conditions = [eq(people.status, 'active')];
      if (query.search?.trim()) {
        const term = `%${query.search.trim()}%`;
        conditions.push(
          or(
            ilike(people.firstName, term),
            ilike(people.lastName, term),
            ilike(people.contactEmail, term),
            ilike(people.documentNumber, term),
          )!,
        );
      }

      const rows = await db
        .select()
        .from(people)
        .where(and(...conditions))
        .orderBy(asc(people.firstName), asc(people.lastName))
        .limit(pageSize);
      return rows.map(toPublicPerson);
    },
  );

  app.get(
    '/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = request.user;
      if (!can(u, 'people.read', { organizationId: u.orgId, communityId: u.communityId ?? null })) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
      const { id } = request.params as { id: string };
      const [person] = await db.select().from(people).where(eq(people.id, id)).limit(1);
      if (!person) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Person not found',
        });
      }
      const [accountRows, membershipRows] = await Promise.all([
        db
          .select({
            id: accounts.id,
            email: accounts.email,
            active: accounts.active,
            isPlatformAdmin: accounts.isPlatformAdmin,
          })
          .from(accounts)
          .where(eq(accounts.personId, id)),
        db
          .select({
            id: memberships.id,
            role: memberships.role,
            status: memberships.status,
            organizationId: memberships.organizationId,
            communityId: memberships.communityId,
            communityName: communities.name,
            locationUnitId: memberships.locationUnitId,
            locationUnitName: locationUnits.name,
          })
          .from(memberships)
          .leftJoin(communities, eq(memberships.communityId, communities.id))
          .leftJoin(locationUnits, eq(memberships.locationUnitId, locationUnits.id))
          .where(eq(memberships.personId, id)),
      ]);

      return {
        ...toPublicPerson(person),
        accounts: accountRows,
        memberships: membershipRows,
      };
    },
  );

  app.post(
    '/',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = request.user;
      if (!can(u, 'people.write', { organizationId: u.orgId, communityId: u.communityId ?? null })) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
      const body = request.body as {
        firstName?: string;
        lastName?: string;
        documentType?: string | null;
        documentNumber?: string | null;
        phone?: string | null;
        contactEmail?: string | null;
      };
      if (!body.firstName?.trim() || !body.lastName?.trim()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'firstName and lastName are required',
        });
      }

      const documentType = body.documentType?.trim() || null;
      const documentNumber = body.documentNumber?.replace(/\s/g, '') || null;
      const contactEmail = body.contactEmail?.trim().toLowerCase() || null;

      if (documentType && documentNumber) {
        const [existing] = await db
          .select({ id: people.id })
          .from(people)
          .where(
            and(
              eq(people.documentType, documentType),
              eq(people.documentNumber, documentNumber),
            ),
          )
          .limit(1);
        if (existing) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A person with that document already exists',
            personId: existing.id,
          });
        }
      } else if (contactEmail) {
        const [existing] = await db
          .select({ id: people.id })
          .from(people)
          .where(
            and(
              eq(people.contactEmail, contactEmail),
              eq(people.firstName, body.firstName.trim()),
              eq(people.lastName, body.lastName.trim()),
            ),
          )
          .limit(1);
        if (existing) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A matching person already exists',
            personId: existing.id,
          });
        }
      }

      try {
        const [created] = await db
          .insert(people)
          .values({
            firstName: body.firstName.trim(),
            lastName: body.lastName.trim(),
            documentType,
            documentNumber,
            phone: body.phone?.trim() || null,
            contactEmail,
            status: 'active',
          })
          .returning();

        await insertEvent({
          eventType: 'person.created',
          actorId: request.user.sub,
          actorPersonId: request.user.personId ?? null,
          actorRole: request.user.role,
          organizationId: request.user.orgId,
          metadata: { personId: created.id },
        });

        return reply.status(201).send(toPublicPerson(created));
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'Conflict',
            message: 'A person with that document already exists',
          });
        }
        throw err;
      }
    },
  );

  app.patch(
    '/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = request.user;
      if (!can(u, 'people.write', { organizationId: u.orgId, communityId: u.communityId ?? null })) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Insufficient permissions',
        });
      }
      const { id } = request.params as { id: string };
      const body = request.body as {
        firstName?: string;
        lastName?: string;
        documentType?: string | null;
        documentNumber?: string | null;
        phone?: string | null;
        contactEmail?: string | null;
        status?: 'active' | 'inactive';
      };
      const [existing] = await db.select().from(people).where(eq(people.id, id)).limit(1);
      if (!existing) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Person not found',
        });
      }

      const [updated] = await db
        .update(people)
        .set({
          ...(body.firstName !== undefined ? { firstName: body.firstName.trim() } : {}),
          ...(body.lastName !== undefined ? { lastName: body.lastName.trim() } : {}),
          ...(body.documentType !== undefined
            ? { documentType: body.documentType?.trim() || null }
            : {}),
          ...(body.documentNumber !== undefined
            ? { documentNumber: body.documentNumber?.replace(/\s/g, '') || null }
            : {}),
          ...(body.phone !== undefined ? { phone: body.phone?.trim() || null } : {}),
          ...(body.contactEmail !== undefined
            ? { contactEmail: body.contactEmail?.trim().toLowerCase() || null }
            : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(people.id, id))
        .returning();

      await insertEvent({
        eventType: 'person.updated',
        actorId: request.user.sub,
        actorPersonId: request.user.personId ?? null,
        actorRole: request.user.role,
        organizationId: request.user.orgId,
        metadata: { personId: id, changedFields: Object.keys(body) },
      });

      return toPublicPerson(updated);
    },
  );

  app.post(
    '/:id/account',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = request.user;
      if (!can(u, 'people.write', { organizationId: u.orgId, communityId: u.communityId ?? null })) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const { id } = request.params as { id: string };
      const body = request.body as {
        email?: string;
        password?: string;
        isPlatformAdmin?: boolean;
      };
      const email = body.email?.trim().toLowerCase();
      const password = body.password;
      if (!email || !password || password.length < 8) {
        return reply.status(400).send({
          error: 'email and password (minimum 8 characters) are required',
        });
      }

      const [person] = await db.select().from(people).where(eq(people.id, id)).limit(1);
      if (!person) return reply.status(404).send({ error: 'Person not found' });

      const [existingAccount] = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.personId, id))
        .limit(1);
      if (existingAccount) {
        return reply.status(409).send({ error: 'Person already has an account' });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      try {
        const [linkedUser] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);
        if (!linkedUser) {
          await db.insert(users).values({
            email,
            passwordHash,
            name: `${person.firstName} ${person.lastName}`.trim() || email,
            active: true,
            isPlatformAdmin: Boolean(body.isPlatformAdmin),
          });
        }

        const [created] = await db
          .insert(accounts)
          .values({
            personId: id,
            email,
            passwordHash,
            active: true,
            isPlatformAdmin: Boolean(body.isPlatformAdmin),
          })
          .returning();

        await insertEvent({
          eventType: 'person.account_created',
          actorId: request.user.sub,
          actorPersonId: request.user.personId ?? null,
          actorRole: request.user.role,
          organizationId: request.user.orgId,
          metadata: { personId: id, accountId: created.id },
        });

        return reply.status(201).send(toPublicAccount(created));
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.status(409).send({ error: 'Account email already exists' });
        }
        throw err;
      }
    },
  );

  app.patch(
    '/:id/account',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const u = request.user;
      if (!can(u, 'people.write', { organizationId: u.orgId, communityId: u.communityId ?? null })) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const { id } = request.params as { id: string };
      const body = request.body as {
        email?: string;
        password?: string;
        active?: boolean;
      };

      const [account] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.personId, id))
        .limit(1);
      if (!account) return reply.status(404).send({ error: 'Account not found' });

      const passwordHash = body.password
        ? await bcrypt.hash(body.password, 10)
        : undefined;
      try {
        const [updated] = await db
          .update(accounts)
          .set({
            ...(body.email !== undefined
              ? { email: body.email.trim().toLowerCase() }
              : {}),
            ...(passwordHash ? { passwordHash } : {}),
            ...(body.active !== undefined ? { active: body.active } : {}),
            updatedAt: new Date(),
          })
          .where(eq(accounts.id, account.id))
          .returning();

        if (body.active === false) {
          await db
            .update(refreshTokens)
            .set({ revoked: true })
            .where(eq(refreshTokens.accountId, account.id));
        }

        await insertEvent({
          eventType: body.active === false ? 'person.account_deactivated' : 'person.account_updated',
          actorId: request.user.sub,
          actorPersonId: request.user.personId ?? null,
          actorRole: request.user.role,
          organizationId: request.user.orgId,
          metadata: { personId: id, accountId: account.id },
        });

        return toPublicAccount(updated);
      } catch (err) {
        if ((err as { code?: string }).code === '23505') {
          return reply.status(409).send({ error: 'Account email already exists' });
        }
        throw err;
      }
    },
  );
}
