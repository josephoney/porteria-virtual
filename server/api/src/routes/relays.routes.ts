import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { kiosks } from '@porteria/database/schema';
import { requireRole } from '../middlewares/rbac.js';
import * as relaysService from '../services/relays.service.js';
import { triggerRelaySchema } from '../schemas/index.js';
import config from '../config.js';

const db = createDb();

export async function relaysRoutes(app: FastifyInstance) {
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
    '/:kioskId/relays',
    { preHandler: [requireRole('admin', 'operator')] },
    async (request: FastifyRequest) => {
      const { kioskId } = request.params as { kioskId: string };
      const relays = await relaysService.getRelaysByKioskId(kioskId);
      return relays.map((r) => ({
        id: r.id,
        relayIndex: r.relayIndex,
        gpioPin: r.gpioPin,
        label: r.label,
        mode: r.mode,
        durationMs: r.durationMs,
        accessPointId: r.accessPointId,
      }));
    },
  );
}

export async function internalRelayRoutes(app: FastifyInstance) {
  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const key = request.headers['x-internal-key'];
    if (key !== config.internalApiKey) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  app.post('/trigger', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = triggerRelaySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.issues,
      });
    }

    const { kioskId, relayIndex, accessPointId } = parseResult.data;

    const relay = relayIndex
      ? await relaysService.getRelayByIndex(kioskId, relayIndex)
      : accessPointId
        ? await relaysService.getRelayForAccessPoint(kioskId, accessPointId)
        : await relaysService.getDoorRelay(kioskId);

    if (!relay) {
      return reply.status(404).send({ error: 'Relay not found' });
    }

    const [kioskRow] = await db
      .select({ rpiId: kiosks.rpiId })
      .from(kiosks)
      .where(eq(kiosks.id, kioskId))
      .limit(1);

    const state = relay.mode === 'latch' ? 'TOGGLE' : 'ON';
    const body: Record<string, unknown> = {
      buildingId: kioskRow?.rpiId ?? kioskId,
      relayIndex: relay.relayIndex,
      state,
      requestId: crypto.randomUUID(),
    };
    if (relay.mode === 'momentary' && relay.durationMs) {
      body.durationMs = relay.durationMs;
    }

    try {
      const res = await fetch(`${config.mqttBridgeUrl}/relays/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return reply.status(502).send({
          error: 'MQTT bridge error',
          details: errBody,
        });
      }
      const data = await res.json();
      return reply.status(200).send(data);
    } catch (err) {
      return reply.status(502).send({
        error: 'MQTT bridge unreachable',
        message: (err as Error).message,
      });
    }
  });
}
