import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { assets, communities, organizations } from '@porteria/database/schema';
import { requireRole } from '../middlewares/rbac.js';
import { insertEvent } from '../services/events.service.js';
import { putAsset, readAsset, removeAsset } from '../services/asset-storage.service.js';

const db = createDb();
const ALLOWED_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
]);
const MAX_BYTES = 500 * 1024;

function fieldValue(value: unknown): string | undefined {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== 'object' || !('value' in item)) return undefined;
  return String((item as { value: unknown }).value);
}
function mimeAllowed(mime: string): boolean {
  return ALLOWED_TYPES.has(mime);
}

function getUser(request: FastifyRequest) {
  return {
    role: request.user.role,
    orgId: request.user.orgId,
    communityId: request.user.communityId ?? null,
    personId: request.user.personId ?? null,
    isPlatformAdmin: Boolean(request.user.isPlatformAdmin),
  };
}

async function communityInScope(communityId: string, user: ReturnType<typeof getUser>) {
  if (user.isPlatformAdmin) return true;
  const [community] = await db
    .select({ organizationId: communities.organizationId })
    .from(communities)
    .where(eq(communities.id, communityId))
    .limit(1);
  if (!community || community.organizationId !== user.orgId) return false;
  if (user.role === 'community_admin' && user.communityId !== communityId) return false;
  return true;
}

export async function assetRoutes(app: FastifyInstance) {
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

  app.post(
    '/',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      if (user.isPlatformAdmin) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'Forbidden',
          message: 'Platform administrators have read-only tenant access',
        });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'A file is required',
        });
      }
      const kind = fieldValue(data.fields.kind) ?? '';
      if (kind !== 'organization_logo' && kind !== 'community_logo') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'kind must be organization_logo or community_logo',
        });
      }
      const communityId = fieldValue(data.fields.communityId) ?? null;
      if (kind === 'community_logo' && !communityId) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'communityId is required for community_logo',
        });
      }
      if (communityId && !(await communityInScope(communityId, user))) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Community not found',
        });
      }
      if (!mimeAllowed(data.mimetype)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Only PNG, JPEG and WEBP images are allowed',
        });
      }

      const buffer = await data.toBuffer();
      if (buffer.byteLength > MAX_BYTES) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Logo must be 500 KB or smaller',
        });
      }

      const extension = ALLOWED_TYPES.get(data.mimetype)!;
      const storageKey = `${user.orgId}/${randomUUID()}.${extension}`;
      await putAsset(storageKey, buffer, data.mimetype);

      try {
        const [created] = await db
          .insert(assets)
          .values({
            organizationId: user.orgId,
            communityId,
            kind,
            storageKey,
            mimeType: data.mimetype,
            sizeBytes: buffer.byteLength,
            checksum: randomUUID(),
            createdByPersonId: user.personId,
          })
          .returning();

        let previousAssetId: string | null = null;
        if (kind === 'organization_logo') {
          const [organization] = await db
            .select({ logoAssetId: organizations.logoAssetId })
            .from(organizations)
            .where(eq(organizations.id, user.orgId))
            .limit(1);
          previousAssetId = organization?.logoAssetId ?? null;
          await db
            .update(organizations)
            .set({ logoAssetId: created.id, updatedAt: new Date() })
            .where(eq(organizations.id, user.orgId));
        } else if (communityId) {
          const [community] = await db
            .select({ logoAssetId: communities.logoAssetId })
            .from(communities)
            .where(eq(communities.id, communityId))
            .limit(1);
          previousAssetId = community?.logoAssetId ?? null;
          await db
            .update(communities)
            .set({ logoAssetId: created.id, updatedAt: new Date() })
            .where(eq(communities.id, communityId));
        }

        if (previousAssetId && previousAssetId !== created.id) {
          const [previous] = await db
            .select({ storageKey: assets.storageKey })
            .from(assets)
            .where(eq(assets.id, previousAssetId))
            .limit(1);
          if (previous) {
            await removeAsset(previous.storageKey).catch(() => {});
            await db.delete(assets).where(eq(assets.id, previousAssetId));
          }
        }

        await insertEvent({
          eventType: 'asset.uploaded',
          actorId: request.user.sub,
          actorRole: user.role,
          organizationId: user.orgId,
          communityId,
          metadata: {
            assetId: created.id,
            kind,
            communityId,
            sizeBytes: created.sizeBytes,
          },
        });

        return reply.status(201).send(created);
      } catch (err) {
        await removeAsset(storageKey).catch(() => {});
        throw err;
      }
    },
  );

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
    if (
      !asset ||
      (!user.isPlatformAdmin && asset.organizationId !== user.orgId) ||
      (user.role === 'community_admin' &&
        asset.communityId &&
        asset.communityId !== user.communityId)
    ) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Asset not found',
      });
    }
    return asset;
  });

  app.get('/:id/content', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = getUser(request);
    const { id } = request.params as { id: string };
    const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
    if (
      !asset ||
      (!user.isPlatformAdmin && asset.organizationId !== user.orgId) ||
      (user.role === 'community_admin' &&
        asset.communityId &&
        asset.communityId !== user.communityId)
    ) {
      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: 'Asset not found',
      });
    }
    return reply.type(asset.mimeType).send(await readAsset(asset.storageKey));
  });

  app.delete(
    '/:id',
    { preHandler: [requireRole('org_admin', 'community_admin')] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = getUser(request);
      const { id } = request.params as { id: string };
      const [asset] = await db
        .select()
        .from(assets)
        .where(
          and(
            eq(assets.id, id),
            user.isPlatformAdmin ? undefined : eq(assets.organizationId, user.orgId),
          ),
        )
        .limit(1);
      if (!asset) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'Not Found',
          message: 'Asset not found',
        });
      }
      await db.delete(assets).where(eq(assets.id, id));
      await removeAsset(asset.storageKey).catch(() => {});
      return reply.status(204).send();
    },
  );
}
