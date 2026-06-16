import { eq, and, count } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import { kiosks, accessPoints, locations } from '@porteria/database/schema';

const db = createDb();

export interface KioskResult {
  id: string;
  name: string;
  rpiId: string | null;
  ipAddress: string | null;
  status: string;
  lastHeartbeat: Date | null;
  accessPointName: string | null;
  locationName: string | null;
}

function toKioskResult(row: Record<string, unknown>): KioskResult {
  return {
    id: row.id as string,
    name: row.name as string,
    rpiId: (row.rpiId as string) ?? null,
    ipAddress: (row.ipAddress as string) ?? null,
    status: row.status as string,
    lastHeartbeat: (row.lastHeartbeat as Date) ?? null,
    accessPointName: (row.accessPointName as string) ?? null,
    locationName: (row.locationName as string) ?? null,
  };
}

export async function listKiosks(
  orgId: string,
  filters: { status?: string },
): Promise<KioskResult[]> {
  const conditions = [eq(locations.organizationId, orgId)];

  if (filters.status) {
    conditions.push(eq(kiosks.status, filters.status as any));
  }

  const rows = await db
    .select({
      id: kiosks.id,
      name: kiosks.name,
      rpiId: kiosks.rpiId,
      ipAddress: kiosks.ipAddress,
      status: kiosks.status,
      lastHeartbeat: kiosks.lastHeartbeat,
      accessPointName: accessPoints.name,
      locationName: locations.name,
    })
    .from(kiosks)
    .leftJoin(accessPoints, eq(kiosks.accessPointId, accessPoints.id))
    .leftJoin(locations, eq(accessPoints.locationId, locations.id))
    .where(and(...conditions));

  return rows.map(toKioskResult);
}

export async function getKiosksCount(orgId: string): Promise<number> {
  const [result] = await db
    .select({ count: count() })
    .from(kiosks)
    .leftJoin(accessPoints, eq(kiosks.accessPointId, accessPoints.id))
    .leftJoin(locations, eq(accessPoints.locationId, locations.id))
    .where(eq(locations.organizationId, orgId));

  return result?.count ?? 0;
}
