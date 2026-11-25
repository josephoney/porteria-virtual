import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { createDb } from '@porteria/database';
import { accessPasses, communities, passAlerts } from '@porteria/database/schema';

import { maskDocument } from '../lib/mask-document.js';
import { insertEvent } from './events.service.js';

const db = createDb();

/** Quién consulta: la alerta se acota a su organización y comunidad. */
export interface AlertRequester {
  accountId: string | null;
  personId: string | null;
  orgId: string;
  communityId: string | null;
  role: string;
  isPlatformAdmin: boolean;
}

export interface AlertItem {
  id: string;
  passId: string;
  communityId: string;
  communityName: string;
  visitorName: string;
  visitorDocument: string;
  type: string;
  status: string;
  dueAt: string;
  createdAt: string;
  resolvedAt: string | null;
  resolvedByName: string | null;
}

export type AlertResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: 'not_found' | 'conflict' | 'forbidden' };

/**
 * Alertas de salida pendiente dentro del alcance del solicitante.
 *
 * Una comunidad ve las suyas; la organización ve todas las de sus comunidades y
 * puede acotar por una. La plataforma siempre llega con organización explícita.
 */
export async function listAlerts(
  requester: AlertRequester,
  status: 'open' | 'resolved' | 'all' = 'open',
): Promise<AlertItem[]> {
  const filters = [eq(communities.organizationId, requester.orgId)];
  if (requester.communityId) filters.push(eq(passAlerts.communityId, requester.communityId));
  if (status !== 'all') filters.push(eq(passAlerts.status, status));

  const rows = await db
    .select({
      id: passAlerts.id,
      passId: passAlerts.passId,
      communityId: passAlerts.communityId,
      communityName: communities.name,
      visitorFirstName: accessPasses.visitorFirstName,
      visitorLastName: accessPasses.visitorLastName,
      visitorDocument: accessPasses.visitorDocument,
      type: passAlerts.type,
      status: passAlerts.status,
      dueAt: passAlerts.dueAt,
      createdAt: passAlerts.createdAt,
      resolvedAt: passAlerts.resolvedAt,
      resolvedByName: sql<string | null>`(
        SELECT TRIM(CONCAT_WS(' ', rp.first_name, rp.last_name))
        FROM people rp WHERE rp.id = ${passAlerts.resolvedByPersonId}
      )`,
    })
    .from(passAlerts)
    .innerJoin(communities, eq(communities.id, passAlerts.communityId))
    .innerJoin(accessPasses, eq(accessPasses.id, passAlerts.passId))
    .where(and(...filters))
    .orderBy(desc(passAlerts.dueAt))
    .limit(200);

  return rows.map((row) => ({
    id: row.id,
    passId: row.passId,
    communityId: row.communityId,
    communityName: row.communityName,
    visitorName: `${row.visitorFirstName} ${row.visitorLastName}`.trim(),
    // La alerta es una consulta, no una verificación: el documento va enmascarado.
    visitorDocument: maskDocument(row.visitorDocument),
    type: row.type,
    status: row.status,
    dueAt: row.dueAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    resolvedByName: row.resolvedByName,
  }));
}

/**
 * Cierra a mano una alerta de salida pendiente.
 *
 * Resolver no significa que la persona salió: `presenceState` no se toca y no se
 * escribe un acceso, porque eso inflaría los reportes con una salida que nadie
 * vio. Queda el registro técnico con autor, motivo y momento.
 */
export async function resolveAlert(
  requester: AlertRequester,
  alertId: string,
  note: string,
): Promise<AlertResult<{ id: string; resolvedAt: string }>> {
  const [alert] = await db
    .select({
      id: passAlerts.id,
      passId: passAlerts.passId,
      communityId: passAlerts.communityId,
      status: passAlerts.status,
    })
    .from(passAlerts)
    .innerJoin(communities, eq(communities.id, passAlerts.communityId))
    .where(and(eq(passAlerts.id, alertId), eq(communities.organizationId, requester.orgId)))
    .limit(1);

  if (!alert) return { ok: false, code: 'not_found' };
  if (requester.communityId && alert.communityId !== requester.communityId) {
    return { ok: false, code: 'not_found' };
  }
  if (alert.status === 'resolved') return { ok: false, code: 'conflict' };

  const resolvedAt = new Date();
  const [updated] = await db
    .update(passAlerts)
    .set({
      status: 'resolved',
      resolvedAt,
      resolvedByPersonId: requester.personId,
    })
    .where(and(eq(passAlerts.id, alertId), eq(passAlerts.status, 'open')))
    .returning({ id: passAlerts.id });

  if (!updated) return { ok: false, code: 'conflict' };

  await insertEvent({
    eventType: 'alert.resolved',
    actorId: requester.accountId ?? undefined,
    actorPersonId: requester.personId ?? undefined,
    actorRole: requester.role,
    organizationId: requester.orgId,
    communityId: alert.communityId,
    metadata: { alertId, passId: alert.passId, note, resolvedAt: resolvedAt.toISOString() },
  });

  return { ok: true, data: { id: alertId, resolvedAt: resolvedAt.toISOString() } };
}

/** Alertas abiertas de una lista de pases, para marcarlas en la bitácora. */
export async function openAlertsByPass(passIds: string[]) {
  if (passIds.length === 0) return new Map<string, string>();

  const rows = await db
    .select({ id: passAlerts.id, passId: passAlerts.passId })
    .from(passAlerts)
    .where(and(inArray(passAlerts.passId, passIds), eq(passAlerts.status, 'open')))
    .orderBy(asc(passAlerts.createdAt));

  const map = new Map<string, string>();
  for (const row of rows) if (!map.has(row.passId)) map.set(row.passId, row.id);
  return map;
}
