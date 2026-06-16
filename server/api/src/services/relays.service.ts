import { eq, and } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { relayOutputs, kiosks } from '@porteria/database/schema';

const db = createDb();

export interface RelayRow {
  id: string;
  kioskId: string;
  relayIndex: number;
  gpioPin: number;
  label: string;
  mode: 'momentary' | 'latch';
  durationMs: number | null;
  accessPointId: string | null;
}

function toRelayRow(row: Record<string, unknown>): RelayRow {
  return {
    id: row.id as string,
    kioskId: row.kioskId as string,
    relayIndex: row.relayIndex as number,
    gpioPin: row.gpioPin as number,
    label: row.label as string,
    mode: (row.mode as string) as 'momentary' | 'latch',
    durationMs: (row.durationMs as number) ?? null,
    accessPointId: (row.accessPointId as string) ?? null,
  };
}

export async function getRelaysByKioskId(kioskId: string): Promise<RelayRow[]> {
  const resolvedId = await getKioskIdByRpiId(kioskId);
  const effectiveId = resolvedId ?? kioskId;

  const rows = await db
    .select()
    .from(relayOutputs)
    .where(eq(relayOutputs.kioskId, effectiveId))
    .orderBy(relayOutputs.relayIndex);

  return rows.map(toRelayRow);
}

export async function getKioskIdByRpiId(rpiId: string): Promise<string | null> {
  const rows = await db
    .select({ id: kiosks.id })
    .from(kiosks)
    .where(eq(kiosks.rpiId, rpiId))
    .limit(1);

  return rows.length > 0 ? rows[0].id : null;
}

export async function getRelayForAccessPoint(
  rpiId: string,
  accessPointId: string,
): Promise<RelayRow | null> {
  const kioskId = await getKioskIdByRpiId(rpiId);
  if (!kioskId) return null;

  const rows = await db
    .select()
    .from(relayOutputs)
    .where(
      and(
        eq(relayOutputs.kioskId, kioskId),
        eq(relayOutputs.accessPointId, accessPointId),
      ),
    )
    .limit(1);

  return rows.length > 0 ? toRelayRow(rows[0]) : null;
}

export async function getRelayByIndex(
  rpiId: string,
  relayIndex: number,
): Promise<RelayRow | null> {
  const kioskId = await getKioskIdByRpiId(rpiId);
  if (!kioskId) return null;

  const rows = await db
    .select()
    .from(relayOutputs)
    .where(
      and(
        eq(relayOutputs.kioskId, kioskId),
        eq(relayOutputs.relayIndex, relayIndex),
      ),
    )
    .limit(1);

  return rows.length > 0 ? toRelayRow(rows[0]) : null;
}

export async function getDoorRelay(rpiId: string): Promise<RelayRow | null> {
  const kioskId = await getKioskIdByRpiId(rpiId);
  if (!kioskId) return null;

  const rows = await db
    .select()
    .from(relayOutputs)
    .where(
      and(
        eq(relayOutputs.kioskId, kioskId),
        eq(relayOutputs.relayIndex, 1),
      ),
    )
    .limit(1);

  return rows.length > 0 ? toRelayRow(rows[0]) : null;
}
