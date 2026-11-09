import { eq, and, count } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { kiosks, accessPoints, communities } from '@porteria/database/schema';

const db = createDb();
type KioskStatusValue = 'idle' | 'calling' | 'in-call' | 'offline';

export interface KioskResult {
  id: string;
  name: string;
  rpiId: string | null;
  ipAddress: string | null;
  status: string;
  lastHeartbeat: Date | null;
  communityId: string;
  communityName: string;
  accessPointName: string | null;
}

function toKioskResult(row: Record<string, unknown>): KioskResult {
  return {
    id: row.id as string,
    name: row.name as string,
    rpiId: (row.rpiId as string) ?? null,
    ipAddress: (row.ipAddress as string) ?? null,
    status: row.status as string,
    lastHeartbeat: (row.lastHeartbeat as Date) ?? null,
    communityId: row.communityId as string,
    communityName: row.communityName as string,
    accessPointName: (row.accessPointName as string) ?? null,
  };
}

export async function listKiosks(
  orgId: string,
  filters: { status?: string; communityId?: string },
): Promise<KioskResult[]> {
  const conditions = [eq(communities.organizationId, orgId)];
  if (filters.status) conditions.push(eq(kiosks.status, filters.status as KioskStatusValue));
  if (filters.communityId) conditions.push(eq(kiosks.communityId, filters.communityId));

  const rows = await db
    .select({
      id: kiosks.id,
      name: kiosks.name,
      rpiId: kiosks.rpiId,
      ipAddress: kiosks.ipAddress,
      status: kiosks.status,
      lastHeartbeat: kiosks.lastHeartbeat,
      communityId: kiosks.communityId,
      communityName: communities.name,
      accessPointName: accessPoints.name,
    })
    .from(kiosks)
    .innerJoin(communities, eq(kiosks.communityId, communities.id))
    .leftJoin(accessPoints, eq(kiosks.accessPointId, accessPoints.id))
    .where(and(...conditions));

  return rows.map(toKioskResult);
}

export async function getKiosksCount(orgId: string, communityId?: string): Promise<number> {
  const conditions = [eq(communities.organizationId, orgId)];
  if (communityId) conditions.push(eq(kiosks.communityId, communityId));

  const [result] = await db
    .select({ count: count() })
    .from(kiosks)
    .innerJoin(communities, eq(kiosks.communityId, communities.id))
    .where(and(...conditions));

  return result?.count ?? 0;
}
